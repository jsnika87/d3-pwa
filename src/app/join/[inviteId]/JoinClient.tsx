// src/app/join/[inviteId]/JoinClient.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function JoinClient({ inviteId }: { inviteId: string }) {
  const [status, setStatus] = useState<
    "idle" | "joining" | "success" | "error" | "need_login"
  >("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    async function run() {
      setStatus("joining");
      setMsg("");

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;

      if (!uid) {
        setStatus("need_login");
        setMsg("Please sign in, then open this invite link again.");
        return;
      }

      try {
        // 1) Consume invite (server should validate code + leader permissions + expiry/uses)
        // Expect your DB function to exist; adjust name/return shape if different.
        const { data, error } = await supabase.rpc("consume_invite", {
          p_invite_code: inviteId,
        });

        if (error) throw error;

        // Many people implement consume_invite returning a uuid (group_id) or an object.
        const groupId =
          typeof data === "string"
            ? data
            : data?.group_id ?? data?.groupId ?? data?.id;

        if (!groupId) {
          throw new Error("Invite did not return a group id.");
        }

        // 2) Insert membership (self)
        const { error: insErr } = await supabase.from("group_memberships").insert({
          group_id: groupId,
          user_id: uid,
          role: "member",
        });

        // If already a member, ignore the duplicate error.
        if (insErr && String(insErr.code) !== "23505") {
          throw insErr;
        }

        setStatus("success");
        setMsg(groupId);

        // Redirect
        window.location.href = `/groups/${groupId}`;
      } catch (e: any) {
        setStatus("error");
        setMsg(e?.message ?? "Failed to join.");
      }
    }

    run();
  }, [inviteId]);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Join Group</h1>

      {status === "joining" && <p>Joining…</p>}

      {status === "need_login" && (
        <>
          <p style={{ color: "salmon" }}>{msg}</p>
          <p>
            Go to <Link href="/login">Login</Link>
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <p style={{ color: "salmon" }}>{msg}</p>
          <p>
            Back to <Link href="/groups">Your Groups</Link>
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <p>Joined! Redirecting…</p>
          <p style={{ opacity: 0.7 }}>Group: {msg}</p>
        </>
      )}
    </main>
  );
}