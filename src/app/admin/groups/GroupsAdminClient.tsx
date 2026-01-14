"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type GroupRow = {
  id: string;
  name: string;
  start_date: string;
  timezone: string;
  created_at: string;
  created_by: string | null;
};

export default function GroupsAdminClient() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const [{ data: g, error: gErr }, { data: m, error: mErr }] = await Promise.all([
        supabase
          .from("groups")
          .select("id,name,start_date,timezone,created_at,created_by")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("group_memberships").select("group_id").limit(5000),
      ]);

      if (gErr) {
        setErr(gErr.message ?? "Failed to load groups");
        setGroups([]);
        setLoading(false);
        return;
      }
      if (mErr) {
        setErr(mErr.message ?? "Failed to load memberships");
      }

      const list = (g ?? []).map((r: any) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        start_date: String(r.start_date ?? ""),
        timezone: String(r.timezone ?? ""),
        created_at: String(r.created_at ?? ""),
        created_by: r.created_by ? String(r.created_by) : null,
      }));

      const counts: Record<string, number> = {};
      for (const row of m ?? []) {
        const gid = String((row as any).group_id ?? "");
        if (!gid) continue;
        counts[gid] = (counts[gid] ?? 0) + 1;
      }

      setGroups(list);
      setMemberCounts(counts);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(s) || g.id.toLowerCase().includes(s));
  }, [groups, q]);

  const surface: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
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

  if (loading) return <div style={{ padding: 8, color: "rgba(255,255,255,0.92)" }}>Loading…</div>;

  return (
    <div style={{ color: "rgba(255,255,255,0.92)" }}>
      <h1 style={{ marginTop: 0 }}>Admin • Groups</h1>

      <div style={{ ...surface, display: "grid", gap: 10 }}>
        <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search group…" />
        {err && <div style={{ color: "salmon" }}>{err}</div>}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ ...surface, opacity: 0.85 }}>No groups found.</div>
        ) : (
          filtered.map((g) => (
            <div key={g.id} style={surface}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>{g.name}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>Members: {memberCounts[g.id] ?? 0}</div>
                <div style={{ marginLeft: "auto" }}>
                  <Link href={`/groups/${g.id}`} style={{ opacity: 0.9 }}>
                    Open in app →
                  </Link>
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                Start: {g.start_date} • TZ: {g.timezone} • Created:{" "}
                {g.created_at ? new Date(g.created_at).toLocaleString() : "—"} • ID: {g.id}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}