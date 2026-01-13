"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Msg = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};

function pickBestName(p?: ProfileRow | null, fallbackId?: string) {
  const name =
    p?.display_name ||
    p?.full_name ||
    p?.name ||
    p?.email ||
    (fallbackId ? fallbackId : "Unknown");
  return name;
}

function isNetworkishError(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("internet_disconnected") ||
    msg.includes("network") ||
    msg.includes("offline")
  );
}

export default function LeadersChatClient() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [userLabels, setUserLabels] = useState<Record<string, string>>({});

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(
    () => text.trim().length > 0 && !!userId && !sending,
    [text, userId, sending]
  );

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  async function ensureProfiles(ids: string[]) {
    const unique = Array.from(new Set(ids)).filter(Boolean);
    const missing = unique.filter((id) => !userLabels[id]);
    if (missing.length === 0) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,full_name,name,email")
      .in("id", missing);

    if (error) return;

    const rows = (data ?? []) as ProfileRow[];
    const next: Record<string, string> = {};

    for (const r of rows) {
      next[r.id] = pickBestName(r, r.id);
    }

    setUserLabels((prev) => ({ ...prev, ...next }));
  }

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

      try {
        const { data, error } = await supabase
          .from("leader_messages")
          .select("id,user_id,body,created_at")
          .order("created_at", { ascending: true })
          .limit(200);

        if (error) throw error;

        const loaded = (data ?? []) as Msg[];
        setMsgs(loaded);

        await ensureProfiles(loaded.map((m) => m.user_id).concat(uid));

        setLoading(false);
        scrollToBottom();
      } catch (e: any) {
        setLoading(false);

        if (isNetworkishError(e)) {
          setErr("You’re offline. Leaders chat needs internet (for now).");
        } else {
          setErr(e?.message ?? "Failed to load messages");
        }
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("leaders_chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leader_messages" },
        async (payload) => {
          const m = payload.new as Msg;

          setMsgs((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });

          await ensureProfiles([m.user_id]);

          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLabels]);

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);

  async function send() {
    setErr(null);
    const body = text.trim();
    if (!body || !userId) return;

    setSending(true);
    setText("");

    const tempId = `temp-${Date.now()}`;
    const optimistic: Msg = {
      id: tempId,
      user_id: userId,
      body,
      created_at: new Date().toISOString(),
    };

    setMsgs((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const { data, error } = await supabase
        .from("leader_messages")
        .insert({
          user_id: userId,
          body,
        })
        .select("id,user_id,body,created_at")
        .single();

      if (error) throw error;

      const saved = data as Msg;
      setMsgs((prev) => prev.map((m) => (m.id === tempId ? saved : m)));

      await ensureProfiles([userId]);

      scrollToBottom();
    } catch (e: any) {
      setMsgs((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);

      if (isNetworkishError(e)) {
        setErr("You’re offline — message not sent.");
      } else {
        setErr(e?.message ?? "Failed to send");
      }
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
              const who =
                m.user_id === userId
                  ? "You"
                  : userLabels[m.user_id] || pickBestName(null, m.user_id);

              return (
                <div key={m.id} style={{ opacity: m.id.startsWith("temp-") ? 0.7 : 0.95 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {new Date(m.created_at).toLocaleString()} • {who}
                    {m.id.startsWith("temp-") ? " (sending…)" : ""}
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