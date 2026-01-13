"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

function isDuplicate(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return code === "23505" || msg.includes("duplicate") || msg.includes("unique");
}

function normalizeError(e: any) {
  return String(e?.message ?? e ?? "Unknown error");
}

export async function joinWithInviteCode(invite_code: string): Promise<
  | { ok: true; group_id: string }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return { ok: false, error: "Not signed in." };
    }

    const code = invite_code.trim();
    if (!code) return { ok: false, error: "Invite code is required." };

    let group_id: string | null = null;

    // 1) Try RPC if you have it
    try {
      const { data, error } = await supabase.rpc("consume_invite", { p_code: code });
      if (!error) {
        group_id =
          typeof data === "string"
            ? data
            : (data?.group_id as string | undefined) ?? null;
      }
    } catch {
      // ignore and fallback below
    }

    // 2) Fallback: lookup invites table directly by code
    if (!group_id) {
      const { data: invite, error: invErr } = await supabase
        .from("invites")
        .select("group_id")
        .eq("invite_code", code)
        .maybeSingle();

      if (invErr) {
        return {
          ok: false,
          error:
            "Could not read invites (RLS or permissions). " +
            normalizeError(invErr),
        };
      }

      if (!invite?.group_id) {
        return { ok: false, error: "Invalid invite code." };
      }

      group_id = invite.group_id as string;
    }

    // 3) Join group as member
    const { error: insErr } = await supabase.from("group_memberships").insert({
      group_id,
      user_id: userData.user.id,
      role: "member",
    });

    if (insErr && !isDuplicate(insErr)) {
      return { ok: false, error: normalizeError(insErr) };
    }

    return { ok: true, group_id };
  } catch (e: any) {
    // IMPORTANT: never throw, return error so client can show it
    return { ok: false, error: normalizeError(e) };
  }
}