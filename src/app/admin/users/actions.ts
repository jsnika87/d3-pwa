"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

async function assertAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: prof, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (error || !prof?.is_admin) throw new Error("Admin access required");
}

export async function setAdminFlag(userId: string, isAdmin: boolean) {
  const supabase = await createSupabaseServerClient();
  await assertAdmin(supabase);

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function setUserRoleAllGroupsAdmin(userId: string, role: "member" | "leader") {
  const supabase = await createSupabaseServerClient();
  await assertAdmin(supabase);

  // Find all groups user is already in
  const { data: rows, error } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const groupIds = (rows ?? []).map((r: any) => r.group_id).filter(Boolean);
  if (groupIds.length === 0) return 0;

  // Update role in all those groups, return updated rows
  const { data: updated, error: updErr } = await supabase
    .from("group_memberships")
    .update({ role })
    .eq("user_id", userId)
    .in("group_id", groupIds)
    .select("group_id"); // simple select, no options

  if (updErr) throw new Error(updErr.message);

  return (updated ?? []).length;
}