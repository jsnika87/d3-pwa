"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ProfileMini = {
  id: string;
  display_name: string;
};

type Msg = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: ProfileMini | ProfileMini[] | null;
};

function getDisplayName(m: Msg): string | null {
  const p = m.profiles;
  if (!p) return null;
  if (Array.isArray(p)) return p[0]?.display_name ?? null;
  return p.display_name ?? null;
}

export default function LeadersChatClient() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => text.trim().length > 0 && !!userId, [text, userId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("leader_messages")
        // ✅ This now works once the FK points to public.profiles(id)
        .select("id,user_id,body,created_at,profiles(id,display_name)")
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) {
        setErr(error.message ?? "Failed to load messages");
        setLoading(false);
        return;
      }

      setMsgs((data ?? []) as Msg[]);
      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    // realtime subscribe for inserts
    const channel = supabase
      .channel("leaders_chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leader_messages" },
        async (payload) => {
          const inserted = payload.new as { id: string };

          // Re-fetch the inserted row including joined profile
          const { data } = await supabase
            .from("leader_messages")
            .select("id,user_id,body,created_at,profiles(id,display_name)")
            .eq("id", inserted.id)
            .single();

          if (!data) return;

          setMsgs((prev) => {
            if (prev.some((x) => x.id === data.id)) return prev;
            return [...prev, data as Msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    setErr(null);
    const body = text.trim();
    if (!body || !userId) return;

    setText("");

    const { data: inserted, error } = await supabase
      .from("leader_messages")
      .insert({ user_id: userId, body })
      .select("id,user_id,body,created_at,profiles(id,display_name)")
      .single();

    if (error) {
      setErr(error.message ?? "Failed to send");
      setText(body);
      return;
    }

    // ✅ immediate UI update (no refresh)
    if (inserted) {
      setMsgs((prev) => {
        if (prev.some((m) => m.id === inserted.id)) return prev;
        return [...prev, inserted as Msg];
      });
    }
  }

  const pageWrap: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: 16,
    color: "rgba(255,255,255,0.92)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: "calc(100vh - 32px)",
  };

  const surface: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
  };

  const inputRow: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
  };

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!userId) return <div style={{ padding: 16 }}>Please sign in.</div>;

  return (
    <div style={pageWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Leaders Chat</h1>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/messages" style={{ opacity: 0.85 }}>
            ← Back
          </Link>
        </div>
      </div>

      {err && (
        <div style={{ ...surface, borderColor: "rgba(255,120,120,0.35)" }}>{err}</div>
      )}

      <div style={{ ...surface, flex: 1, overflow: "auto" }}>
        {msgs.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No messages yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {msgs.map((m) => {
              const name =
                m.user_id === userId ? "You" : (getDisplayName(m) ?? "Unknown");

              return (
                <div key={m.id} style={{ opacity: 0.95 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {new Date(m.created_at).toLocaleString()} • {name}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div style={surface}>
        <div style={inputRow}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message leaders…"
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.25)",
              color: "rgba(255,255,255,0.92)",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
            }}
          />
          <button style={btn} disabled={!canSend} onClick={send}>
            Send
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          Tip: Ctrl+Enter (or Cmd+Enter) to send
        </div>
      </div>
    </div>
  );
}