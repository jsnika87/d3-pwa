"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { generateInviteCode } from "@/lib/inviteCode";
import { revalidatePath } from "next/cache";

export async function createInvite(groupId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const invite_code = generateInviteCode();

  const { error } = await supabase.from("invites").insert({
    group_id: groupId,
    created_by: user.id,
    invite_code,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/groups/${groupId}`);
}