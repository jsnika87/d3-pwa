"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function joinWithInviteCode(inviteCode: string): Promise<
  | { ok: true; group_id: string }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error("joinWithInviteCode auth error:", userErr);
      return { ok: false, error: "Authentication error. Please sign in again." };
    }

    if (!user) {
      return { ok: false, error: "Not authenticated. Please sign in again." };
    }

    const code = inviteCode.trim().toUpperCase();
    if (!code) return { ok: false, error: "Enter an invite code." };

    // ✅ One RPC does everything: validates invite, increments uses, creates membership
    const { data, error } = await supabase.rpc("join_group_by_code", {
      p_code: code,
    });

    if (error) {
      console.error("join_group_by_code error:", error);
      return { ok: false, error: error.message ?? "Invalid invite code." };
    }

    // Supabase returns uuid as string
    const group_id = typeof data === "string" ? data : null;

    if (!group_id) {
      console.error("join_group_by_code returned unexpected data:", data);
      return { ok: false, error: "Invalid invite code." };
    }

    return { ok: true, group_id };
  } catch (e: any) {
    console.error("joinWithInviteCode unexpected error:", e);
    return { ok: false, error: e?.message ?? "Invalid invite code." };
  }
}