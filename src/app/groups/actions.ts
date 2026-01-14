"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function createGroup(input: { name: string; start_date: string; timezone: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) throw new Error("Not authenticated");

  const n = input.name.trim();
  if (!n) throw new Error("Group name required");

  const { data: g, error: gErr } = await supabase
    .from("groups")
    .insert({
      name: n,
      start_date: input.start_date,
      timezone: input.timezone,
      created_by: au.user.id,
    })
    .select("id")
    .single();

  if (gErr) throw new Error(gErr.message);

  const { error: mErr } = await supabase.from("group_memberships").insert({
    group_id: g.id,
    user_id: au.user.id,
    role: "leader",
  });
  if (mErr) throw new Error(mErr.message);

  return { id: g.id as string };
}

export async function createInviteForGroup(groupId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) throw new Error("Not authenticated");

  // Leader check
  const { data: gm, error: gmErr } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", au.user.id)
    .single();

  if (gmErr || !gm || gm.role !== "leader") throw new Error("Leader access required");

  const { data, error } = await supabase
    .from("invites")
    .insert({
      group_id: groupId,
      created_by: au.user.id,
      is_active: true,
    })
    .select("invite_code")
    .single();

  if (error) throw new Error(error.message);

  // best-effort audit (won't block invite)
  try {
    await supabase.from("invite_audit").insert({
      event: "invite_created",
      group_id: groupId,
      invite_code: data.invite_code,
      actor_user_id: au.user.id,
      target_user_id: null,
    });
  } catch {}

  return { code: data.invite_code as string };
}

export async function revokeInvite(inviteCode: string) {
  const supabase = await createSupabaseServerClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) throw new Error("Not authenticated");

  const code = inviteCode.trim().toUpperCase();

  // Find invite to get group_id
  const { data: inv, error: iErr } = await supabase
    .from("invites")
    .select("group_id, invite_code")
    .eq("invite_code", code)
    .single();

  if (iErr || !inv) throw new Error("Invite not found");

  // Leader check
  const { data: gm, error: gmErr } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("group_id", inv.group_id)
    .eq("user_id", au.user.id)
    .single();

  if (gmErr || !gm || gm.role !== "leader") throw new Error("Leader access required");

  const { error } = await supabase
    .from("invites")
    .update({ is_active: false })
    .eq("invite_code", code);

  if (error) throw new Error(error.message);

  // best-effort audit
  try {
    await supabase.from("invite_audit").insert({
      event: "invite_revoked",
      group_id: inv.group_id,
      invite_code: code,
      actor_user_id: au.user.id,
      target_user_id: null,
    });
  } catch {}

  return { ok: true };
}