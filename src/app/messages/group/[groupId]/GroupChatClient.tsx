"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ProfileMini = {
  id: string;
  display_name: string | null;
};

type Msg = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: ProfileMini | ProfileMini[] | null; // Supabase sometimes returns object or array depending on relationship
};

function pickProfile(p: Msg["profiles"]): ProfileMini | null {
  if (!p) return null;
  if (Array.isArray(p)) return p[0] ?? null;
  return p;
}

function displayNameFor(m: Msg, fallback = "Unknown") {
  const p = pickProfile(m.profiles);
  return p?.display_name?.trim() ? p.display_name : fallback;
}

export default function GroupChatClient({ groupId }: { groupId: string }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("Group");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(
    () => text.trim().length > 0 && !!userId && !sending,
    [text, userId, sending]
  );

  // Load initial
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

      // Group name
      const { data: g } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();

      if (g?.name) setGroupName(g.name);

      // Messages + profile display names
      const { data, error } = await supabase
        .from("group_messages")
        .select(
          `
          id,
          group_id,
          user_id,
          body,
          created_at,
          profiles:profiles ( id, display_name )
        `
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(150);

      if (error) {
        setErr(error.message ?? "Failed to load messages");
        setLoading(false);
        return;
      }

      setMsgs((data ?? []) as Msg[]);
      setLoading(false);
    }

    load();
  }, [groupId]);

  // Realtime subscribe for inserts (dedupe)
  useEffect(() => {
    const channel = supabase
      .channel(`group_chat:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const incoming = payload.new as Msg;

          // If realtime payload doesn't include joined profile (it won't),
          // we still add it; name rendering will fall back unless your
          // subscription is configured to include it (usually it's not).
          setMsgs((prev) => {
            if (prev.some((x) => x.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  // Keep scrolled to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    setErr(null);
    const body = text.trim();
    if (!body || !userId || sending) return;

    setSending(true);
    setText("");

    try {
      // ✅ Insert and immediately get the inserted row back (with profile display_name)
      const { data, error } = await supabase
        .from("group_messages")
        .insert({
          group_id: groupId,
          user_id: userId,
          body,
        })
        .select(
          `
          id,
          group_id,
          user_id,
          body,
          created_at,
          profiles:profiles ( id, display_name )
        `
        )
        .single();

      if (error || !data) {
        setErr(error?.message ?? "Failed to send");
        setText(body);
        return;
      }

      // ✅ Optimistically update UI now (no refresh needed)
      setMsgs((prev) => {
        if (prev.some((x) => x.id === data.id)) return prev;
        return [...prev, data as Msg];
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send");
      setText(body);
    } finally {
      setSending(false);
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
    opacity: canSend ? 1 : 0.6,
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!userId) return <div style={{ padding: 16 }}>Please sign in.</div>;

  return (
    <div style={pageWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>{groupName} Chat</h1>
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
            {msgs.map((m) => (
              <div key={m.id} style={{ opacity: 0.95 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {new Date(m.created_at).toLocaleString()} •{" "}
                  {m.user_id === userId ? "You" : displayNameFor(m, "Unknown")}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div style={surface}>
        <div style={inputRow}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message the group…"
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
            disabled={sending}
          />
          <button style={btn} disabled={!canSend} onClick={send}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          Tip: Ctrl+Enter (or Cmd+Enter) to send
        </div>
      </div>
    </div>
  );
}