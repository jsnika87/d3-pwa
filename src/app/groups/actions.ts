"use server";

import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type CreateGroupInput = {
  name: string;
  start_date: string; // yyyy-mm-dd
  timezone: string;
};

function makeInviteCode(length = 10) {
  // Avoid confusing characters (I, O, 0, 1)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function createGroup(input: CreateGroupInput) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const name = input.name?.trim();
  const start_date = input.start_date?.trim();
  const timezone = input.timezone?.trim();

  if (!name) throw new Error("Missing group name");
  if (!start_date) throw new Error("Missing start date");
  if (!timezone) throw new Error("Missing timezone");

  // This assumes your existing RLS/DB logic allows leaders to create groups
  // and automatically creates membership (or you handle elsewhere).
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name,
      start_date,
      timezone,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message ?? "Failed to create group");
  if (!data?.id) throw new Error("Failed to create group (missing id)");

  return { group_id: data.id as string };
}

export async function createInviteForGroup(groupId: string) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const gid = groupId?.trim();
  if (!gid) throw new Error("Missing groupId");

  // Try a few times in case invite_code is unique and we hit a rare collision
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeInviteCode(10);

    const { data, error } = await supabase
      .from("invites")
      .insert({
        group_id: gid,
        created_by: user.id,
        invite_code: code, // ✅ FIX: explicitly set it so it can never be null
        is_active: true,
        uses: 0,
        // max_uses / expires_at can stay null unless you want them
      })
      .select("invite_code")
      .single();

    if (!error && data?.invite_code) {
      return { code: data.invite_code as string };
    }

    // If you have a UNIQUE constraint on invites.invite_code, collisions will throw.
    // Only retry on collision/unique errors; otherwise fail loudly.
    const msg = (error?.message ?? "").toLowerCase();
    const isDup =
      msg.includes("duplicate") ||
      msg.includes("unique constraint") ||
      msg.includes("violates unique");

    if (!isDup) {
      throw new Error(error?.message ?? "Failed to create invite");
    }
  }

  throw new Error("Failed to create invite (could not generate a unique code)");
}