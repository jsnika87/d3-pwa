"use client";

import { useEffect, useState } from "react";
import { joinWithInviteCode } from "./actions";
import { useRouter } from "next/navigation";
import { isOnline } from "@/lib/offlineQueue";

export default function JoinClient({
  initialCode,
  autoSubmit,
}: {
  initialCode?: string;
  autoSubmit?: boolean;
}) {
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function submit(c: string) {
    setMsg(null);

    const trimmed = c.trim();
    if (!trimmed) {
      setMsg("Enter an invite code.");
      return;
    }

    if (!isOnline()) {
      setMsg("You must be online to join a group.");
      return;
    }

    setBusy(true);
    try {
      const res = await joinWithInviteCode(trimmed);

      if (!res.ok) {
        setMsg(res.error);
        return;
      }

      setMsg("Joined! Redirecting…");
      router.push(`/groups/${res.group_id}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoSubmit && code.trim()) {
      submit(code.trim());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, []);

  const pageWrap: React.CSSProperties = {
    maxWidth: 600,
    margin: "0 auto",
    padding: 16,
    color: "rgba(255,255,255,0.92)",
  };

  const surface: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
  };

  const pillBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    width: "100%",
  };

  return (
    <div style={pageWrap}>
      <h1 style={{ marginTop: 0 }}>Join a Group</h1>

      <div style={surface}>
        <div style={{ opacity: 0.85, marginBottom: 10 }}>
          Paste the invite code you received.
        </div>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invite code (e.g. ABCD2345EF)"
          style={inputStyle}
        />

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button
            style={pillBtn}
            disabled={busy || !code.trim() || !isOnline()}
            onClick={() => submit(code)}
          >
            {busy ? "Joining…" : isOnline() ? "Join" : "Offline"}
          </button>

          <button
            style={pillBtn}
            disabled={busy}
            onClick={() => {
              setCode("");
              setMsg(null);
            }}
          >
            Clear
          </button>
        </div>

        {msg && (
          <div style={{ marginTop: 10, opacity: 0.95, whiteSpace: "pre-wrap" }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}