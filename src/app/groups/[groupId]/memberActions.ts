"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function setRoleByEmail(
  groupId: string,
  email: string,
  role: "member" | "leader"
) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.rpc("promote_member_by_email", {
    p_group_id: groupId,
    p_email: email,
    p_role: role,
  });

  if (error) throw new Error(error.message);
}