"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

function randomCode(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function createGroup(input: { name: string; start_date: string; timezone: string }) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not signed in");

  // OPTIONAL STRICT MODE:
  // If you truly want "only existing leaders can create new groups",
  // uncomment this check.
  const { data: leaderCheck } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "leader")
    .limit(1);

  if (!leaderCheck || leaderCheck.length === 0) {
    throw new Error("Only leaders can create groups.");
  }

  const { data: group, error: gErr } = await supabase
    .from("groups")
    .insert({
      name: input.name,
      start_date: input.start_date,
      timezone: input.timezone,
      created_by: userData.user.id,
    })
    .select("id,name,start_date,timezone")
    .single();

  if (gErr) throw new Error(gErr.message);

  // Make creator the leader of the new group
  const { error: mErr } = await supabase.from("group_memberships").insert({
    group_id: group.id,
    user_id: userData.user.id,
    role: "leader",
  });

  if (mErr) throw new Error(mErr.message);

  return { group };
}

export async function createInviteForGroup(groupId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not signed in");

  // Ensure caller is leader of that group
  const { data: mem, error: memErr } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userData.user.id)
    .single();

  if (memErr || !mem) throw new Error("Not a member of this group");
  if (mem.role !== "leader") throw new Error("Only leaders can create invites for this group");

  const code = randomCode(10);

  const { error } = await supabase.from("invites").insert({
    group_id: groupId,
    invite_code: code,
    created_by: userData.user.id,
    // optionally: expires_at, max_uses, uses
  });

  if (error) throw new Error(error.message);

  return { code };
}