"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Msg = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

function labelForUser(uid: string, me: string | null, labels: Record<string, string>) {
  if (me && uid === me) return "You";
  return labels[uid] || uid;
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

export default function GroupChatClient({ groupId }: { groupId: string }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("Group");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // user_id -> display_name
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
      .select("id,display_name")
      .in("id", missing);

    if (error) return;

    const rows = (data ?? []) as ProfileRow[];
    const next: Record<string, string> = {};
    for (const r of rows) next[r.id] = r.display_name || r.id;

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

      // group name
      const { data: g, error: gErr } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();

      if (!gErr && g?.name) setGroupName(g.name);

      // messages
      const { data, error } = await supabase
        .from("group_messages")
        .select("id,group_id,user_id,body,created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) {
        setErr(error.message ?? "Failed to load messages");
        setLoading(false);
        return;
      }

      const loaded = (data ?? []) as Msg[];
      setMsgs(loaded);

      await ensureProfiles(loaded.map((m) => m.user_id).concat(uid));

      setLoading(false);
      scrollToBottom();
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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
  }, [groupId, userLabels]);

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

    // optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic: Msg = {
      id: tempId,
      group_id: groupId,
      user_id: userId,
      body,
      created_at: new Date().toISOString(),
    };

    setMsgs((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const { data, error } = await supabase
        .from("group_messages")
        .insert({ group_id: groupId, user_id: userId, body })
        .select("id,group_id,user_id,body,created_at")
        .single();

      if (error) throw error;

      const saved = data as Msg;

      setMsgs((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      await ensureProfiles([userId]);
      scrollToBottom();
    } catch (e: any) {
      setMsgs((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);

      setErr(
        isNetworkishError(e)
          ? "You’re offline — message not sent."
          : (e?.message ?? "Failed to send")
      );
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
              <div key={m.id} style={{ opacity: m.id.startsWith("temp-") ? 0.7 : 0.95 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {new Date(m.created_at).toLocaleString()} •{" "}
                  {labelForUser(m.user_id, userId, userLabels)}
                  {m.id.startsWith("temp-") ? " (sending…)" : ""}
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