"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { createGroup, createInviteForGroup, revokeInvite } from "./actions";
import { setRoleByEmail } from "./[groupId]/memberActions";
import { isOnline } from "@/lib/offlineQueue";

type Group = {
  id: string;
  name: string;
  start_date: string;
  timezone: string;
};

type Membership = {
  role: "leader" | "member";
  group: Group;
};

type InviteRow = {
  invite_code: string;
  created_at: string;
  uses: number | null;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
};

function normalizeGroup(m: any): Group | null {
  const g = Array.isArray(m?.group) ? m.group?.[0] : m?.group;
  if (!g?.id) return null;
  return {
    id: String(g.id),
    name: String(g.name ?? ""),
    start_date: String(g.start_date ?? ""),
    timezone: String(g.timezone ?? ""),
  };
}

function buildInviteUrl(code: string) {
  if (typeof window === "undefined") return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}

export default function GroupsClient() {
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // auth
  const [userId, setUserId] = useState<string | null>(null);

  // ---- Leader tool: update member role (choose group + email + role) ----
  const [selectedLeaderGroupId, setSelectedLeaderGroupId] = useState<string>("");
  const [roleEmail, setRoleEmail] = useState("");
  const [roleValue, setRoleValue] = useState<"member" | "leader">("leader");
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);

  // ---- Leader tool: create group ----
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupStart, setNewGroupStart] = useState(""); // yyyy-mm-dd
  const [newGroupTz, setNewGroupTz] = useState("America/Chicago");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // ---- Invite quick output ----
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null); // groupId

  // ---- Invite management (list + revoke) ----
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [revokeBusyCode, setRevokeBusyCode] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setMemberships([]);
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
        setErrMsg(error.message ?? "Failed to load groups");
        setMemberships([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      const next: Membership[] = [];

      for (const r of rows) {
        const g = normalizeGroup(r);
        if (!g) continue;

        const role = (r?.role === "leader" ? "leader" : "member") as "leader" | "member";
        next.push({ role, group: g });
      }

      setMemberships(next);

      // pick default leader group for tools
      const firstLeader = next.find((m) => m.role === "leader");
      if (firstLeader && !selectedLeaderGroupId) {
        setSelectedLeaderGroupId(firstLeader.group.id);
      }

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaderMemberships = useMemo(
    () => memberships.filter((m) => m.role === "leader"),
    [memberships]
  );

  const isLeaderAnywhere = leaderMemberships.length > 0;

  const selectedLeaderGroup = useMemo(() => {
    return leaderMemberships.find((m) => m.group.id === selectedLeaderGroupId) ?? null;
  }, [leaderMemberships, selectedLeaderGroupId]);

  async function logout() {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (e: any) {
      setErrMsg(e?.message ?? "Failed to logout");
    }
  }

  async function refreshInvites(groupId: string) {
    if (!groupId) return;
    if (!isOnline()) return;

    setInvitesLoading(true);
    setErrMsg(null);
    try {
      const { data, error } = await supabase
        .from("invites")
        .select("invite_code,created_at,uses,max_uses,expires_at,is_active")
        .eq("group_id", groupId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) throw error;

      setInvites((data ?? []) as InviteRow[]);
    } catch (e: any) {
      setErrMsg(e?.message ?? "Failed to load invites");
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }

  // auto-load invites for the selected leader group
  useEffect(() => {
    if (!isLeaderAnywhere) return;
    if (!selectedLeaderGroupId) return;
    if (!isOnline()) return;

    refreshInvites(selectedLeaderGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaderGroupId, isLeaderAnywhere]);

  // ---- Styles (now light+dark safe via CSS vars) ----
  const pageWrap: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: 16,
    color: "var(--fg)",
  };

  const surface: React.CSSProperties = {
    border: "1px solid var(--surface-border)",
    borderRadius: 12,
    padding: 12,
    background: "var(--surface-bg)",
  };

  const pillBtn: React.CSSProperties = {
    border: "1px solid var(--btn-border)",
    background: "var(--btn-bg)",
    color: "var(--fg)",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const inputStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--fg)",
    outline: "none",
    width: "100%",
  };

  if (loading) {
    return <div style={pageWrap}>Loading…</div>;
  }

  return (
    <div style={pageWrap}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Your Groups</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/messages" style={{ textDecoration: "none" }}>
            <button style={pillBtn}>💬 Messages</button>
          </Link>

          <Link href="/join" style={{ textDecoration: "none" }}>
            <button style={pillBtn}>Join with code</button>
          </Link>

          <button style={pillBtn} onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {errMsg && (
        <div style={{ marginTop: 10, color: "salmon" }}>
          {errMsg}
        </div>
      )}

      {/* Groups list */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {memberships.length === 0 ? (
          <div style={{ ...surface, opacity: 0.85 }}>
            You’re not in any groups.
          </div>
        ) : (
          memberships.map((m) => (
            <div key={m.group.id} style={{ ...surface }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{m.group.name}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  ({m.role})
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <Link href={`/groups/${m.group.id}`} style={{ textDecoration: "none" }}>
                    <button style={pillBtn}>Open</button>
                  </Link>

                  {/* Leader-only invite button per group */}
                  {m.role === "leader" && (
                    <button
                      style={pillBtn}
                      disabled={!isOnline() || inviteBusy === m.group.id}
                      onClick={async () => {
                        setInviteMsg(null);
                        setInviteBusy(m.group.id);
                        try {
                          const res = await createInviteForGroup(m.group.id);
                          const url = buildInviteUrl(res.code);

                          const msg =
                            `Invite created for "${m.group.name}"\n` +
                            `Code: ${res.code}\n` +
                            `Link: ${url}`;

                          setInviteMsg(msg);

                          // refresh invite list if this is the selected leader group
                          if (m.group.id === selectedLeaderGroupId) {
                            await refreshInvites(m.group.id);
                          }
                        } catch (e: any) {
                          setInviteMsg(e?.message ?? "Failed to create invite");
                        } finally {
                          setInviteBusy(null);
                        }
                      }}
                    >
                      {inviteBusy === m.group.id ? "Creating…" : isOnline() ? "Create invite" : "Offline"}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                Start: {m.group.start_date} • TZ: {m.group.timezone}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick invite output */}
      {inviteMsg && (
        <div style={{ marginTop: 12, ...surface }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Invite</div>
          <div style={{ opacity: 0.9, whiteSpace: "pre-wrap" }}>{inviteMsg}</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={pillBtn}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteMsg);
                } catch {}
              }}
            >
              Copy
            </button>

            <button
              style={pillBtn}
              onClick={async () => {
                // Share if available (mobile)
                try {
                  // Try to extract link
                  const lines = inviteMsg.split("\n");
                  const linkLine = lines.find((l) => l.startsWith("Link: "));
                  const link = linkLine ? linkLine.replace("Link: ", "").trim() : "";

                  // @ts-ignore
                  if (navigator.share && link) {
                    // @ts-ignore
                    await navigator.share({ title: "D3 Invite", text: inviteMsg, url: link });
                  }
                } catch {}
              }}
            >
              Share
            </button>

            <button style={pillBtn} onClick={() => setInviteMsg(null)}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Leader-only tools */}
      {isLeaderAnywhere && (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {/* Create group */}
          <div style={surface}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Create Group</div>

            <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              <input
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                style={inputStyle}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  type="date"
                  value={newGroupStart}
                  onChange={(e) => setNewGroupStart(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Timezone (e.g. America/Chicago)"
                  value={newGroupTz}
                  onChange={(e) => setNewGroupTz(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <button
                style={pillBtn}
                disabled={
                  creatingGroup ||
                  !isOnline() ||
                  !newGroupName.trim() ||
                  !newGroupStart.trim() ||
                  !newGroupTz.trim()
                }
                onClick={async () => {
                  setCreatingGroup(true);
                  setErrMsg(null);
                  try {
                    await createGroup({
                      name: newGroupName.trim(),
                      start_date: newGroupStart.trim(),
                      timezone: newGroupTz.trim(),
                    });

                    // refresh list after create
                    window.location.reload();
                  } catch (e: any) {
                    setErrMsg(e?.message ?? "Failed to create group");
                  } finally {
                    setCreatingGroup(false);
                  }
                }}
              >
                {creatingGroup ? "Creating…" : isOnline() ? "Create group" : "Offline"}
              </button>

              <div style={{ opacity: 0.75, fontSize: 12 }}>
                Note: New groups automatically add you as a <b>leader</b>.
              </div>
            </div>
          </div>

          {/* Invite management */}
          <div style={surface}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
              Invite Management
            </div>

            <div style={{ display: "grid", gap: 10, maxWidth: 620 }}>
              <select
                value={selectedLeaderGroupId}
                onChange={(e) => setSelectedLeaderGroupId(e.target.value)}
                style={inputStyle}
              >
                <option value="" disabled>
                  Select a group…
                </option>
                {leaderMemberships.map((m) => (
                  <option key={m.group.id} value={m.group.id}>
                    {m.group.name}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={pillBtn}
                  disabled={!isOnline() || !selectedLeaderGroupId}
                  onClick={async () => {
                    if (!selectedLeaderGroupId) return;
                    try {
                      const res = await createInviteForGroup(selectedLeaderGroupId);
                      const url = buildInviteUrl(res.code);
                      setInviteMsg(
                        `Invite created for "${selectedLeaderGroup?.group.name ?? "Group"}"\n` +
                          `Code: ${res.code}\n` +
                          `Link: ${url}`
                      );
                      await refreshInvites(selectedLeaderGroupId);
                    } catch (e: any) {
                      setErrMsg(e?.message ?? "Failed to create invite");
                    }
                  }}
                >
                  Create invite for selected group
                </button>

                <button
                  style={pillBtn}
                  disabled={!isOnline() || !selectedLeaderGroupId || invitesLoading}
                  onClick={() => refreshInvites(selectedLeaderGroupId)}
                >
                  {invitesLoading ? "Refreshing…" : "Refresh invites"}
                </button>
              </div>

              {!isOnline() && (
                <div style={{ opacity: 0.8, fontSize: 12 }}>
                  You must be online to manage invites.
                </div>
              )}

              {isOnline() && selectedLeaderGroupId && (
                <div style={{ display: "grid", gap: 10 }}>
                  {invitesLoading ? (
                    <div style={{ opacity: 0.85 }}>Loading invites…</div>
                  ) : invites.length === 0 ? (
                    <div style={{ opacity: 0.85 }}>No active invites for this group.</div>
                  ) : (
                    invites.map((inv) => {
                      const url = buildInviteUrl(inv.invite_code);
                      const uses = inv.uses ?? 0;
                      const max = inv.max_uses ?? null;
                      const exp = inv.expires_at ? new Date(inv.expires_at).toLocaleString() : "never";

                      return (
                        <div key={inv.invite_code} style={{ ...surface }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ fontWeight: 900 }}>
                              {inv.invite_code}
                            </div>

                            <div style={{ opacity: 0.75, fontSize: 12 }}>
                              uses: {uses}
                              {max !== null ? ` / ${max}` : ""} • expires: {exp}
                            </div>

                            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                style={pillBtn}
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(inv.invite_code);
                                  } catch {}
                                }}
                              >
                                Copy code
                              </button>

                              <button
                                style={pillBtn}
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(url);
                                  } catch {}
                                }}
                              >
                                Copy link
                              </button>

                              <button
                                style={pillBtn}
                                onClick={async () => {
                                  try {
                                    // @ts-ignore
                                    if (navigator.share) {
                                      // @ts-ignore
                                      await navigator.share({
                                        title: "D3 Invite",
                                        text: `Join my group with code ${inv.invite_code}`,
                                        url,
                                      });
                                    }
                                  } catch {}
                                }}
                              >
                                Share
                              </button>

                              <button
                                style={pillBtn}
                                disabled={revokeBusyCode === inv.invite_code}
                                onClick={async () => {
                                  setRevokeBusyCode(inv.invite_code);
                                  setErrMsg(null);

                                  // ✅ optimistic UI removal
                                  setInvites((prev) => prev.filter((x) => x.invite_code !== inv.invite_code));

                                  try {
                                    await revokeInvite(inv.invite_code);
                                    await refreshInvites(selectedLeaderGroupId);
                                  } catch (e: any) {
                                    // restore on failure by reloading list
                                    setErrMsg(e?.message ?? "Failed to revoke invite");
                                    await refreshInvites(selectedLeaderGroupId);
                                  } finally {
                                    setRevokeBusyCode(null);
                                  }
                                }}
                              >
                                {revokeBusyCode === inv.invite_code ? "Revoking…" : "Revoke"}
                              </button>
                            </div>
                          </div>

                          <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
                            Link: {url}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Update member role (keep existing feature) */}
          <div style={surface}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Leader Tools</div>

            <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              <select
                value={selectedLeaderGroupId}
                onChange={(e) => setSelectedLeaderGroupId(e.target.value)}
                style={inputStyle}
              >
                <option value="" disabled>
                  Select a group…
                </option>
                {leaderMemberships.map((m) => (
                  <option key={m.group.id} value={m.group.id}>
                    {m.group.name}
                  </option>
                ))}
              </select>

              <input
                placeholder="Member email (must already have an account)"
                value={roleEmail}
                onChange={(e) => setRoleEmail(e.target.value)}
                style={inputStyle}
              />

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <select
                  value={roleValue}
                  onChange={(e) => setRoleValue(e.target.value as "member" | "leader")}
                  style={{ ...inputStyle, maxWidth: 160 }}
                >
                  <option value="leader">leader</option>
                  <option value="member">member</option>
                </select>

                <button
                  style={pillBtn}
                  disabled={roleSaving || !isOnline() || !selectedLeaderGroupId || !roleEmail.trim()}
                  onClick={async () => {
                    setRoleMsg(null);
                    setRoleSaving(true);
                    try {
                      await setRoleByEmail(selectedLeaderGroupId, roleEmail.trim(), roleValue);
                      setRoleMsg(`Updated role to "${roleValue}" for ${roleEmail.trim()}`);
                      setRoleEmail("");
                    } catch (e: any) {
                      setRoleMsg(e?.message ?? "Failed to update role");
                    } finally {
                      setRoleSaving(false);
                    }
                  }}
                >
                  {roleSaving ? "Updating…" : isOnline() ? "Update role" : "Offline"}
                </button>
              </div>

              {roleMsg && <div style={{ opacity: 0.85, fontSize: 12 }}>{roleMsg}</div>}
            </div>
          </div>
        </div>
      )}

      {/* If user is not leader anywhere, still show join hint */}
      {!isLeaderAnywhere && (
        <div style={{ marginTop: 16, ...surface, opacity: 0.9 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Want to join a group?</div>
          <div style={{ opacity: 0.85 }}>
            Use{" "}
            <Link href="/join" style={{ color: "var(--fg)" }}>
              Join with code
            </Link>
            .
          </div>
        </div>
      )}
    </div>
  );
}