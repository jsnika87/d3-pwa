"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Group = {
  id: string;
  name: string;
  start_date: string;
  timezone: string;
};

type MembershipRow = {
  role: string;
  group: Group | Group[] | null;
};

export default function MessagesClient() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Array<{ group: Group; role: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg(null);

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("group_memberships")
        .select(
          `
          role,
          group:groups (
            id,
            name,
            start_date,
            timezone
          )
        `
        )
        .eq("user_id", uid);

      if (error) {
        setErrorMsg(error.message ?? "Failed to load memberships");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as MembershipRow[];

      const normalized: Array<{ group: Group; role: string }> = rows
        .map((r) => {
          const g = Array.isArray(r.group) ? r.group[0] : r.group;
          if (!g) return null;
          return { group: g, role: r.role };
        })
        .filter(Boolean) as Array<{ group: Group; role: string }>;

      setMemberships(normalized);
      setLoading(false);
    }

    load();
  }, []);

  const isLeaderAnywhere = useMemo(() => memberships.some((m) => m.role === "leader"), [memberships]);

  // styles
  const pageWrap: React.CSSProperties = {
    maxWidth: 900,
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

  const cardButton: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    display: "block",
  };

  const cardSubtitle: React.CSSProperties = {
    marginTop: 6,
    opacity: 0.8,
    fontSize: 14,
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!userId) return <div style={{ padding: 16 }}>Please sign in.</div>;

  return (
    <div style={pageWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Messages</h1>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/groups" style={{ opacity: 0.85 }}>
            ← Back to Groups
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div style={{ ...surface, borderColor: "rgba(255,120,120,0.35)", marginBottom: 12 }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {/* Global leaders chat */}
        {isLeaderAnywhere && (
          <Link href="/messages/leaders" style={{ textDecoration: "none" }}>
            <div style={cardButton}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Leaders Chat (Global)</div>
              <div style={cardSubtitle}>Only leaders can see/write here</div>
            </div>
          </Link>
        )}

        {/* Group chats */}
        <div style={surface}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Your Groups</div>

          {memberships.length === 0 ? (
            <div style={{ opacity: 0.85 }}>You’re not in any groups.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {memberships.map((m) => (
                <Link
                  key={m.group.id}
                  href={`/messages/group/${m.group.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div style={cardButton}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{m.group.name}</div>
                    <div style={cardSubtitle}>Group chat • role: {m.role}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}