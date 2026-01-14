"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function setUserRoleAllGroups(userId: string, role: "leader" | "member") {
  const supabase = await createSupabaseServerClient();

  const { data: count, error } = await supabase.rpc("set_user_role_all_groups", {
    p_user_id: userId,
    p_role: role,
  });

  if (error) {
    console.error("set_user_role_all_groups error:", error);
    throw new Error(error.message ?? "Failed to update role");
  }

  return (count ?? 0) as number;
}