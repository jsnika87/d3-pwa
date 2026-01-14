"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function joinGroupByCode(inviteCode: string) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const code = inviteCode.trim().toUpperCase();

  // ✅ One RPC does everything: validate invite, consume uses, create membership
  const { data: groupId, error } = await supabase.rpc("join_group_by_code", {
    p_code: code,
  });

  if (error || !groupId) {
    // Helpful for debugging in Vercel logs
    console.error("join_group_by_code error:", error);
    throw new Error(error?.message ?? "Invalid invite code");
  }

  return groupId as string;
}