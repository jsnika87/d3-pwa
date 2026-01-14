"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { setAdminFlag, setUserRoleAllGroupsAdmin } from "./actions";
import { isOnline } from "@/lib/offlineQueue";

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  is_admin: boolean;
};

export default function UsersAdminClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,email,created_at,is_admin")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        setErr(error.message ?? "Failed to load users");
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []).map((r: any) => ({
        id: String(r.id),
        display_name: r.display_name ?? null,
        email: r.email ?? null,
        created_at: String(r.created_at),
        is_admin: !!r.is_admin,
      })));

      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const a = (r.display_name ?? "").toLowerCase();
      const b = (r.email ?? "").toLowerCase();
      const c = r.id.toLowerCase();
      return a.includes(s) || b.includes(s) || c.includes(s);
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
      <h1 style={{ marginTop: 0 }}>Admin • Users</h1>

      <div style={{ ...surface, display: "grid", gap: 10 }}>
        <input
          style={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by display name, email, or id…"
        />

        {err && <div style={{ color: "salmon" }}>{err}</div>}
        {msg && <div style={{ opacity: 0.9, whiteSpace: "pre-wrap" }}>{msg}</div>}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ ...surface, opacity: 0.85 }}>No users found.</div>
        ) : (
          filtered.map((u) => (
            <div key={u.id} style={surface}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>
                  {u.display_name?.trim() || u.email || u.id}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>
                    Admin: {u.is_admin ? "yes" : "no"}
                  </span>

                  <button
                    style={btn}
                    disabled={!isOnline() || busyUserId === u.id}
                    onClick={async () => {
                      setErr(null);
                      setMsg(null);
                      setBusyUserId(u.id);
                      try {
                        await setAdminFlag(u.id, !u.is_admin);
                        setRows((prev) =>
                          prev.map((x) => (x.id === u.id ? { ...x, is_admin: !u.is_admin } : x))
                        );
                        setMsg(`Updated admin flag for ${u.email ?? u.id}.`);
                      } catch (e: any) {
                        setErr(e?.message ?? "Failed to update admin flag");
                      } finally {
                        setBusyUserId(null);
                      }
                    }}
                  >
                    {busyUserId === u.id ? "Saving…" : u.is_admin ? "Remove Admin" : "Make Admin"}
                  </button>

                  <button
                    style={btn}
                    disabled={!isOnline() || busyUserId === u.id}
                    onClick={async () => {
                      setErr(null);
                      setMsg(null);
                      setBusyUserId(u.id);
                      try {
                        const updated = await setUserRoleAllGroupsAdmin(u.id, "leader");
                        setMsg(`Set "${u.email ?? u.id}" to leader in ${updated} group(s).`);
                      } catch (e: any) {
                        setErr(e?.message ?? "Failed to set leader role");
                      } finally {
                        setBusyUserId(null);
                      }
                    }}
                  >
                    Make Leader Everywhere
                  </button>

                  <button
                    style={btn}
                    disabled={!isOnline() || busyUserId === u.id}
                    onClick={async () => {
                      setErr(null);
                      setMsg(null);
                      setBusyUserId(u.id);
                      try {
                        const updated = await setUserRoleAllGroupsAdmin(u.id, "member");
                        setMsg(`Set "${u.email ?? u.id}" to member in ${updated} group(s).`);
                      } catch (e: any) {
                        setErr(e?.message ?? "Failed to set member role");
                      } finally {
                        setBusyUserId(null);
                      }
                    }}
                  >
                    Make Member Everywhere
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                Email: {u.email ?? "—"} • Created: {new Date(u.created_at).toLocaleString()} • ID:{" "}
                {u.id}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}