"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Counts = {
  users: number;
  groups: number;
  memberships: number;
  invites: number;
  groupMessages: number;
  leaderMessages: number;
  newUsers7d: number;
  newGroups7d: number;
  invites7d: number;
};

export default function AdminHomeClient() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
          users,
          groups,
          memberships,
          invites,
          gm,
          lm,
          newUsers7d,
          newGroups7d,
          invites7d,
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("groups").select("*", { count: "exact", head: true }),
          supabase.from("group_memberships").select("*", { count: "exact", head: true }),
          supabase.from("invites").select("*", { count: "exact", head: true }),
          supabase.from("group_messages").select("*", { count: "exact", head: true }),
          supabase.from("leader_messages").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
          supabase.from("groups").select("*", { count: "exact", head: true }).gte("created_at", since),
          supabase.from("invites").select("*", { count: "exact", head: true }).gte("created_at", since),
        ]);

        const anyErr =
          users.error ||
          groups.error ||
          memberships.error ||
          invites.error ||
          gm.error ||
          lm.error ||
          newUsers7d.error ||
          newGroups7d.error ||
          invites7d.error;

        if (anyErr) throw anyErr;

        setCounts({
          users: users.count ?? 0,
          groups: groups.count ?? 0,
          memberships: memberships.count ?? 0,
          invites: invites.count ?? 0,
          groupMessages: gm.count ?? 0,
          leaderMessages: lm.count ?? 0,
          newUsers7d: newUsers7d.count ?? 0,
          newGroups7d: newGroups7d.count ?? 0,
          invites7d: invites7d.count ?? 0,
        });
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load admin dashboard");
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

  if (loading) return <div style={{ padding: 8 }}>Loading…</div>;

  return (
    <div style={{ color: "rgba(255,255,255,0.92)" }}>
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>

      {err && <div style={{ ...surface, borderColor: "rgba(255,120,120,0.35)" }}>{err}</div>}

      {counts && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={surface}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Totals</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <Stat label="Users" value={counts.users} />
              <Stat label="Groups" value={counts.groups} />
              <Stat label="Memberships" value={counts.memberships} />
              <Stat label="Invites" value={counts.invites} />
              <Stat label="Group Messages" value={counts.groupMessages} />
              <Stat label="Leader Messages" value={counts.leaderMessages} />
            </div>
          </div>

          <div style={surface}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Last 7 Days</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <Stat label="New Users" value={counts.newUsers7d} />
              <Stat label="New Groups" value={counts.newGroups7d} />
              <Stat label="Invites Created" value={counts.invites7d} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: 12 }}>
      <div style={{ opacity: 0.75, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
    </div>
  );
}