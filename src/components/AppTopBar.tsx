"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

export default function AppTopBar({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {backHref ? (
        <Link href={backHref} style={{ opacity: 0.9, textDecoration: "none" }}>
          ← Back
        </Link>
      ) : (
        <span />
      )}

      <div style={{ fontWeight: 900 }}>{title}</div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
        <button
          onClick={logout}
          disabled={busy}
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          {busy ? "Signing out…" : "Logout"}
        </button>
      </div>
    </div>
  );
}