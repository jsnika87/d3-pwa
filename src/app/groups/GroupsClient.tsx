"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { createGroup, createInviteForGroup } from "./actions";
import { isOnline } from "@/lib/offlineQueue";
import { setUserRoleAllGroups } from "./roleActions";

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

type ProfileMini = {
  id: string;
  display_name: string | null;
  email: string | null;
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

export default function GroupsClient() {
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ---- Leader tool: create group ----
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupStart, setNewGroupStart] = useState(""); // yyyy-mm-dd
  const [newGroupTz, setNewGroupTz] = useState("America/Chicago");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // ---- Leader tool: invite ----
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null); // groupId

  // ---- Leader tool: global role mgmt ----
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [allProfiles, setAllProfiles] = useState<ProfileMini[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [roleValue, setRoleValue] = useState<"member" | "leader">("leader");
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);

  const leaderMemberships = useMemo(
    () => memberships.filter((m) => m.role === "leader"),
    [memberships]
  );

  const isLeaderAnywhere = leaderMemberships.length > 0;

  const selectedProfile = useMemo(() => {
    return allProfiles.find((p) => p.id === selectedUserId) ?? null;
  }, [allProfiles, selectedUserId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;

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
      setLoading(false);
    }

    load();
  }, []);

  // Load all profiles (active users) for dropdown (leader-only)
  useEffect(() => {
    async function loadProfiles() {
      if (!isLeaderAnywhere) return;

      setProfilesLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,display_name,email")
          .order("display_name", { ascending: true });

        if (error) throw error;

        const list = (data ?? []) as ProfileMini[];

        const cleaned = list
          .filter((p) => !!p?.id)
          .map((p) => ({
            id: String(p.id),
            display_name: p.display_name ?? null,
            email: p.email ?? null,
          }));

        setAllProfiles(cleaned);
        if (!selectedUserId && cleaned.length > 0) {
          setSelectedUserId(cleaned[0].id);
        }
      } catch (e: any) {
        setErrMsg(e?.message ?? "Failed to load users");
      } finally {
        setProfilesLoading(false);
      }
    }

    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeaderAnywhere]);

  async function logout() {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  // ---- Styles (match your existing vibe) ----
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

  const pillBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    width: "100%",
  };

  if (loading) return <div style={pageWrap}>Loading…</div>;

  return (
    <div style={pageWrap}>
      {/* HEADER: restore your original layout */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Your Groups</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
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

      {errMsg && <div style={{ marginTop: 10, color: "salmon" }}>{errMsg}</div>}

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {memberships.length === 0 ? (
          <div style={{ ...surface, opacity: 0.85 }}>You’re not in any groups.</div>
        ) : (
          memberships.map((m) => (
            <div key={m.group.id} style={{ ...surface }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{m.group.name}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>({m.role})</div>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <Link
                    href={`/groups/${m.group.id}`}
                    style={{ ...pillBtn, textDecoration: "none" }}
                  >
                    Open
                  </Link>

                  {m.role === "leader" && (
                    <button
                      style={pillBtn}
                      disabled={!isOnline() || inviteBusy === m.group.id}
                      onClick={async () => {
                        setInviteMsg(null);
                        setInviteBusy(m.group.id);
                        try {
                          const res = await createInviteForGroup(m.group.id);
                          const url =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/join/${res.code}`
                              : `/join/${res.code}`;

                          setInviteMsg(
                            `Invite created for "${m.group.name}".\n\nCode: ${res.code}\nLink: ${url}`
                          );
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

      {inviteMsg && (
        <div style={{ marginTop: 12, ...surface }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Invite</div>
          <div style={{ opacity: 0.85, whiteSpace: "pre-wrap" }}>{inviteMsg}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
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
            <button style={pillBtn} onClick={() => setInviteMsg(null)}>
              Clear
            </button>
          </div>
        </div>
      )}

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

          {/* Global Role tool */}
          <div style={surface}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
              Leader Tools (Global Role)
            </div>

            <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={inputStyle}
                disabled={profilesLoading || allProfiles.length === 0}
              >
                {allProfiles.length === 0 ? (
                  <option value="">No users found</option>
                ) : (
                  allProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.display_name && p.display_name.trim()) || p.email || p.id}
                    </option>
                  ))
                )}
              </select>

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
                  disabled={roleSaving || !isOnline() || !selectedUserId}
                  onClick={async () => {
                    setRoleMsg(null);
                    setRoleSaving(true);
                    try {
                      const updated = await setUserRoleAllGroups(selectedUserId, roleValue);
                      setRoleMsg(
                        `Updated "${selectedProfile?.display_name ?? selectedProfile?.email ?? selectedUserId
                        }" to "${roleValue}" in ${updated} group(s).`
                      );
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

              <div style={{ opacity: 0.75, fontSize: 12 }}>
                This updates the user’s role in <b>every group they are already a member of</b>.
              </div>

              {roleMsg && <div style={{ opacity: 0.9, fontSize: 12 }}>{roleMsg}</div>}
            </div>
          </div>
        </div>
      )}

      {!isLeaderAnywhere && (
        <div style={{ marginTop: 16, ...surface, opacity: 0.9 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Want to join a group?</div>
          <div style={{ opacity: 0.8 }}>
            Use{" "}
            <Link href="/join" style={{ color: "rgba(255,255,255,0.92)" }}>
              Join with code
            </Link>
            .
          </div>
        </div>
      )}
    </div>
  );
}