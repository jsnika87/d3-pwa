"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isOnline } from "@/lib/offlineQueue";

type InviteRow = {
  id: string;
  group_id: string;
  created_by: string;
  invite_code: string | null;
  uses: number;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export default function InvitesAdminClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("invites")
        .select("id,group_id,created_by,invite_code,uses,max_uses,expires_at,is_active,created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        setErr(error.message ?? "Failed to load invites");
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []).map((r: any) => ({
        id: String(r.id),
        group_id: String(r.group_id),
        created_by: String(r.created_by),
        invite_code: r.invite_code ? String(r.invite_code) : null,
        uses: Number(r.uses ?? 0),
        max_uses: r.max_uses === null ? null : Number(r.max_uses),
        expires_at: r.expires_at ? String(r.expires_at) : null,
        is_active: !!r.is_active,
        created_at: String(r.created_at),
      })));

      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      return (
        (r.invite_code ?? "").toLowerCase().includes(s) ||
        r.group_id.toLowerCase().includes(s) ||
        r.created_by.toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

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

  if (loading) return <div style={{ padding: 8, color: "rgba(255,255,255,0.92)" }}>Loading…</div>;

  return (
    <div style={{ color: "rgba(255,255,255,0.92)" }}>
      <h1 style={{ marginTop: 0 }}>Admin • Invites</h1>

      <div style={{ ...surface, display: "grid", gap: 10 }}>
        <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invite code / group_id / creator…" />
        {err && <div style={{ color: "salmon" }}>{err}</div>}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ ...surface, opacity: 0.85 }}>No invites found.</div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} style={surface}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>
                  {r.invite_code ?? "(null code)"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {r.is_active ? "active" : "revoked"} • uses {r.uses}
                  {r.max_uses ? ` / ${r.max_uses}` : ""}
                </div>

                <div style={{ marginLeft: "auto" }}>
                  <button
                    style={btn}
                    disabled={!isOnline() || !r.is_active || busyId === r.id}
                    onClick={async () => {
                      setErr(null);
                      setBusyId(r.id);
                      try {
                        const { error } = await supabase
                          .from("invites")
                          .update({ is_active: false })
                          .eq("id", r.id);

                        if (error) throw error;

                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: false } : x)));
                      } catch (e: any) {
                        setErr(e?.message ?? "Failed to revoke invite");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {busyId === r.id ? "Revoking…" : r.is_active ? "Revoke" : "Revoked"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                group_id: {r.group_id} • created_by: {r.created_by} • created:{" "}
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}