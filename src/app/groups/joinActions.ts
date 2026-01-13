"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function joinGroupByCode(inviteCode: string) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const code = inviteCode.trim().toUpperCase();

  // Atomically validate + increment uses + return group_id
  // NOTE: Your RPC parameter name is p_code (matches your SQL function)
  const { data: groupId, error: consumeErr } = await supabase.rpc("consume_invite", {
    p_code: code,
  });

  if (consumeErr || !groupId) {
    throw new Error(consumeErr?.message ?? "Invalid invite code");
  }

  // Add user to the group
  const { error: memberErr } = await supabase.from("group_memberships").insert({
    group_id: groupId,
    user_id: user.id,
    role: "member",
  });

  if (memberErr) {
    // Ignore "already joined" (unique constraint) cases
    const msg = memberErr.message?.toLowerCase?.() ?? "";
    const isDuplicate =
      msg.includes("duplicate") ||
      msg.includes("already exists") ||
      msg.includes("unique constraint") ||
      msg.includes("violates unique");

    if (!isDuplicate) {
      throw new Error(memberErr.message);
    }
  }

  return groupId;
}