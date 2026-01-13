"use server";

import { createClient } from "@supabase/supabase-js";

type RoleValue = "member" | "leader";

/**
 * Server-side admin action:
 * sets a user's role in a specific group by their email.
 *
 * Requirements:
 * - You must have SUPABASE_SERVICE_ROLE_KEY in env for this server action.
 * - Your DB RLS should allow the service role to update group_memberships.
 */
export async function setRoleByEmail(groupId: string, email: string, role: RoleValue) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error("Email is required");

  // 1) Find the user by email
  const { data: userData, error: userErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (userErr) throw userErr;

  const found = userData?.users?.find((u) => (u.email ?? "").toLowerCase() === cleanEmail);
  if (!found?.id) {
    throw new Error("No user found with that email (they must already have an account).");
  }

  // 2) Update membership role in this group
  const { error: updErr } = await admin
    .from("group_memberships")
    .update({ role })
    .eq("group_id", groupId)
    .eq("user_id", found.id);

  if (updErr) throw updErr;

  return { ok: true };
}