"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaderMsg = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type GroupMsg = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export default function MessagesAdminClient() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leaders" | "groups">("leaders");
  const [leaderMsgs, setLeaderMsgs] = useState<LeaderMsg[]>([]);
  const [groupMsgs, setGroupMsgs] = useState<GroupMsg[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const [lm, gm] = await Promise.all([
          supabase
            .from("leader_messages")
            .select("id,user_id,body,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("group_messages")
            .select("id,group_id,user_id,body,created_at")
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

        if (lm.error) throw lm.error;
        if (gm.error) throw gm.error;

        setLeaderMsgs((lm.data ?? []) as any);
        setGroupMsgs((gm.data ?? []) as any);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load messages");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const surface: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
  };

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const input: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    width: "100%",
  };

  const filteredLeader = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return leaderMsgs;
    return leaderMsgs.filter((m) => m.body.toLowerCase().includes(s) || m.user_id.toLowerCase().includes(s));
  }, [leaderMsgs, q]);

  const filteredGroup = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groupMsgs;
    return groupMsgs.filter((m) => m.body.toLowerCase().includes(s) || m.user_id.toLowerCase().includes(s) || m.group_id.toLowerCase().includes(s));
  }, [groupMsgs, q]);

  if (loading) return <div style={{ padding: 8, color: "rgba(255,255,255,0.92)" }}>Loading…</div>;

  return (
    <div style={{ color: "rgba(255,255,255,0.92)" }}>
      <h1 style={{ marginTop: 0 }}>Admin • Messages</h1>

      <div style={{ ...surface, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={() => setTab("leaders")}>
            Leaders
          </button>
          <button style={btn} onClick={() => setTab("groups")}>
            Groups
          </button>
        </div>

        <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />

        {err && <div style={{ color: "salmon" }}>{err}</div>}
      </div>

      <div style={{ marginTop: 12, ...surface }}>
        {tab === "leaders" ? (
          filteredLeader.length === 0 ? (
            <div style={{ opacity: 0.85 }}>No leader messages found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredLeader.map((m) => (
                <div key={m.id}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {new Date(m.created_at).toLocaleString()} • {m.user_id}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
              ))}
            </div>
          )
        ) : filteredGroup.length === 0 ? (
          <div style={{ opacity: 0.85 }}>No group messages found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredGroup.map((m) => (
              <div key={m.id}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {new Date(m.created_at).toLocaleString()} • group:{m.group_id} • {m.user_id}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}