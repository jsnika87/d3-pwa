"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMaxWeek, getWeekContent } from "@/lib/d3Content";
import {
  enqueue,
  getQueue,
  removeQueueItem,
  isOnline,
  localPutResponse,
  localGetResponses,
  localPutGroupContext,
  localGetGroupContext,
  localPutPassage,
  localGetPassage,
  initOfflineDb,
  type QueueItem,
} from "@/lib/offlineQueue";
import Link from "next/link";

type PassageKey = "p1" | "p2" | "p3" | "p4" | "p5";
type ResponseKey = "r1" | "r2" | "r3" | "r4";

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

type WeekCompletionRow = {
  week_number: number;
};

type PassageHtmlResult = {
  reference: string;
  html: string;
};

type ActiveSection =
  | { kind: "memory"; ref: string; key: string }
  | { kind: "reading"; ref: string; index: number; key: string };

type PassageResponseRow = {
  passage_key: PassageKey;
  response_key: ResponseKey;
  response_text: string;
};

const bibleId = 2692;

const RESPONSE_LABELS = [
  "Highlight 1–2 verses",
  "Explain portion",
  "Application",
  "Response",
] as const;

function isoToDateOnly(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function weeksBetween(start: Date, now: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startDay = Math.floor(start.getTime() / msPerDay);
  const nowDay = Math.floor(now.getTime() / msPerDay);
  const diffDays = nowDay - startDay;
  return Math.floor(diffDays / 7);
}

async function fetchPassageHtml(ref: string, bibleIdNum: number): Promise<PassageHtmlResult> {
  const url = `/api/youversion/verses?ref=${encodeURIComponent(ref)}&bibleId=${bibleIdNum}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Passage fetch failed (${res.status}): ${text || "No body"}`);
  }

  const json = await res.json().catch(() => null);
  const html = json?.youversion?.content;

  if (!html || typeof html !== "string") {
    throw new Error("Passage response missing youversion.content (string)");
  }

  return { reference: json.youversion.reference ?? ref, html };
}

function sectionKeyFor(week: number, kind: "memory" | "reading", ref: string, index?: number) {
  return `${week}:${kind}:${index ?? ""}:${ref}`;
}

type Resp4 = { a: string; b: string; c: string; d: string };

function passageKeyFromIndex(idx: number): PassageKey {
  return `p${idx + 1}` as PassageKey;
}

function responseKeyFromField(field: keyof Resp4): ResponseKey {
  if (field === "a") return "r1";
  if (field === "b") return "r2";
  if (field === "c") return "r3";
  return "r4";
}

function emptyResp4(): Resp4 {
  return { a: "", b: "", c: "", d: "" };
}

function isNetworkishError(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("internet_disconnected") ||
    msg.includes("network") ||
    msg.includes("fetch failed")
  );
}

export default function GroupClient({ groupId }: { groupId: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [offlineNeedsOnlineOnce, setOfflineNeedsOnlineOnce] = useState(false);

  

  // Week UI
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Completions
  const [completedWeeks, setCompletedWeeks] = useState<Set<number>>(new Set());
  const [savingCompletion, setSavingCompletion] = useState(false);

  // Passage cache (in-memory) + errors
  const [passages, setPassages] = useState<Record<string, PassageHtmlResult | null>>({});
  const [passageLoading, setPassageLoading] = useState<Record<string, boolean>>({});
  const [passageErrors, setPassageErrors] = useState<Record<string, string | null>>({});

  // Navigation
  const [activeSection, setActiveSection] = useState<ActiveSection | null>(null);

  // Responses
  const [responses, setResponses] = useState<Record<string, Resp4>>({});
  const [responsesLoading, setResponsesLoading] = useState(false);

  const saveTimersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    initOfflineDb();
  }, []);

  // ---- Boot: session -> membership fetch -> fallback to cached group context
  useEffect(() => {
    async function load() {
      setLoading(true);
      setOfflineNeedsOnlineOnce(false);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      try {
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
          .eq("group_id", groupId)
          .eq("user_id", uid)
          .single();

        if (error || !data) throw error ?? new Error("Membership not found");

        const membership = data as unknown as MembershipRow;
        const groupData = Array.isArray(membership.group) ? membership.group[0] : membership.group;
        if (!groupData) throw new Error("Missing group data");

        setGroup(groupData);
        setRole(membership.role);

        await localPutGroupContext({
          group_id: groupId,
          user_id: uid,
          role: membership.role,
          group: {
            id: groupData.id,
            name: groupData.name,
            start_date: groupData.start_date,
            timezone: groupData.timezone,
          },
          cached_at: Date.now(),
        });

        const start = isoToDateOnly(groupData.start_date);
        if (start) {
          const now = new Date();
          const week0 = weeksBetween(start, now);
          const computedWeek = Math.min(getMaxWeek(), Math.max(1, week0 + 1));
          setSelectedWeek(computedWeek);
        } else {
          setSelectedWeek(1);
        }

        setLoading(false);
        return;
      } catch (e: any) {
        if (!isOnline() || isNetworkishError(e)) {
          const cached = await localGetGroupContext({ group_id: groupId, user_id: uid });
          if (cached?.group) {
            setGroup(cached.group);
            setRole(cached.role);

            const start = isoToDateOnly(cached.group.start_date);
            if (start) {
              const now = new Date();
              const week0 = weeksBetween(start, now);
              const computedWeek = Math.min(getMaxWeek(), Math.max(1, week0 + 1));
              setSelectedWeek(computedWeek);
            } else {
              setSelectedWeek(1);
            }

            setLoading(false);
            return;
          }

          setOfflineNeedsOnlineOnce(true);
          setLoading(false);
          return;
        }

        console.error("Group membership load error:", e);
        setLoading(false);
      }
    }

    load();
  }, [groupId]);

  const weekContent = useMemo(() => getWeekContent(selectedWeek), [selectedWeek]);
  const maxWeek = getMaxWeek();

  const readings = weekContent?.readings ?? [];
  const memoryVerseRef = weekContent?.memoryVerse ?? "";

  const isCompleted = completedWeeks.has(selectedWeek);

  useEffect(() => {
    setActiveSection(null);
  }, [selectedWeek]);

  // ---- Completions (online-only)
  useEffect(() => {
    async function loadCompletions() {
      if (!userId) return;

      const { data, error } = await supabase
        .from("week_completions")
        .select("week_number")
        .eq("group_id", groupId)
        .eq("user_id", userId);

      if (error) {
        if (!isOnline()) return;
        console.error("week_completions load error:", error);
        return;
      }

      const rows = (data ?? []) as WeekCompletionRow[];
      setCompletedWeeks(new Set(rows.map((r) => r.week_number)));
    }

    loadCompletions();
  }, [groupId, userId]);

  // ---- Responses for week (fallback to IndexedDB)
  useEffect(() => {
    async function loadResponsesForWeek() {
      if (!userId) return;

      setResponsesLoading(true);

      const { data, error } = await supabase
        .from("passage_responses")
        .select("passage_key,response_key,response_text")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .eq("week_number", selectedWeek);

      if (error) {
        if (isOnline()) console.error("passage_responses load error:", error);

        const local = await localGetResponses({
          group_id: groupId,
          user_id: userId,
          week_number: selectedWeek,
        });

        const next: Record<string, Resp4> = {};
        const refs = readings.slice(0, 5);

        for (let idx = 0; idx < refs.length; idx++) {
          const ref = refs[idx];
          const sectionKey = sectionKeyFor(selectedWeek, "reading", ref, idx);

          const a = local[`${groupId}:${userId}:${selectedWeek}:p${idx + 1}:r1`] ?? "";
          const b = local[`${groupId}:${userId}:${selectedWeek}:p${idx + 1}:r2`] ?? "";
          const c = local[`${groupId}:${userId}:${selectedWeek}:p${idx + 1}:r3`] ?? "";
          const d = local[`${groupId}:${userId}:${selectedWeek}:p${idx + 1}:r4`] ?? "";

          next[sectionKey] = { a, b, c, d };
        }

        setResponses(next);
        setResponsesLoading(false);
        return;
      }

      const rows = (data ?? []) as PassageResponseRow[];

      const next: Record<string, Resp4> = {};
      const refs = readings.slice(0, 5);

      for (let idx = 0; idx < refs.length; idx++) {
        const ref = refs[idx];
        const key = sectionKeyFor(selectedWeek, "reading", ref, idx);
        next[key] = emptyResp4();
      }

      for (const row of rows) {
        const idx = Number(row.passage_key.slice(1)) - 1;
        const ref = refs[idx];
        if (!ref) continue;

        const sectionKey = sectionKeyFor(selectedWeek, "reading", ref, idx);
        const cur = next[sectionKey] ?? emptyResp4();

        const txt = row.response_text ?? "";
        if (row.response_key === "r1") cur.a = txt;
        if (row.response_key === "r2") cur.b = txt;
        if (row.response_key === "r3") cur.c = txt;
        if (row.response_key === "r4") cur.d = txt;

        next[sectionKey] = cur;
      }

      setResponses(next);
      setResponsesLoading(false);
    }

    if (!userId) return;
    loadResponsesForWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userId, selectedWeek, readings.join("|")]);

  // ---- Queue flush
  async function flushOfflineQueue() {
    if (!userId) return;
    if (!isOnline()) return;

    const items = await getQueue();
    if (!items.length) return;

    const ordered = [...items].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

    for (const item of ordered) {
      try {
        if (item.type === "upsert_response") {
          const { error } = await supabase
            .from("passage_responses")
            .upsert(item.payload, {
              onConflict: "group_id,user_id,week_number,passage_key,response_key",
            });
          if (error) throw error;
        }

        if (item.type === "upsert_week_completion") {
          const { error } = await supabase
            .from("week_completions")
            .upsert(item.payload, { onConflict: "group_id,user_id,week_number" });
          if (error) throw error;
        }

        if (item.type === "delete_week_completion") {
          const { error } = await supabase
            .from("week_completions")
            .delete()
            .eq("group_id", item.payload.group_id)
            .eq("user_id", item.payload.user_id)
            .eq("week_number", item.payload.week_number);
          if (error) throw error;
        }

        if (item.id) await removeQueueItem(item.id);
      } catch (e) {
        console.error("flushOfflineQueue failed on item:", item, e);
        return;
      }
    }
  }

  useEffect(() => {
    function onOnline() {
      flushOfflineQueue();
    }
    window.addEventListener("online", onOnline);
    flushOfflineQueue();
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---- Persist cell
  function scheduleSaveCell(passageKey: PassageKey, responseKey: ResponseKey, value: string) {
    if (!userId) return;

    const timerKey = `${groupId}:${userId}:${selectedWeek}:${passageKey}:${responseKey}`;
    if (saveTimersRef.current[timerKey]) clearTimeout(saveTimersRef.current[timerKey]);

    saveTimersRef.current[timerKey] = setTimeout(async () => {
      const payload = {
        group_id: groupId,
        user_id: userId,
        week_number: selectedWeek,
        passage_key: passageKey,
        response_key: responseKey,
        response_text: value,
      };

      await localPutResponse(payload);

      if (!isOnline()) {
        await enqueue({ type: "upsert_response", createdAt: Date.now(), payload } as QueueItem);
        return;
      }

      const { error } = await supabase.from("passage_responses").upsert(payload, {
        onConflict: "group_id,user_id,week_number,passage_key,response_key",
      });

      if (error) {
        console.error("passage_responses upsert error (queued):", error);
        await enqueue({ type: "upsert_response", createdAt: Date.now(), payload } as QueueItem);
        return;
      }

      flushOfflineQueue();
    }, 400);
  }

  function canMarkWeekCompleteLocal(weekNumber: number) {
    const wc = getWeekContent(weekNumber);
    const refs = (wc?.readings ?? []).slice(0, 5);
    if (refs.length === 0) return false;

    return refs.every((ref, idx) => {
      const key = sectionKeyFor(weekNumber, "reading", ref, idx);
      const r = responses[key];
      if (!r) return false;
      return r.a.trim() && r.b.trim() && r.c.trim() && r.d.trim();
    });
  }

  const canCompleteLocal = canMarkWeekCompleteLocal(selectedWeek);
  const showCompleteHint = !isCompleted && !canCompleteLocal;

  // ---- PASSAGE loader (offline-first)
  useEffect(() => {
    async function ensureActivePassageLoaded() {
      if (!activeSection) return;
      const ref = activeSection.ref;
      if (!ref) return;

      // already in memory cache
      if (passages[ref] !== undefined) return;

      setPassageErrors((prev) => ({ ...prev, [ref]: null }));
      setPassageLoading((prev) => ({ ...prev, [ref]: true }));

      try {
        // OFFLINE: use local cached passage if available
        if (!isOnline()) {
          const cached = await localGetPassage({ bibleId, ref });
          if (cached?.html) {
            setPassages((prev) => ({
              ...prev,
              [ref]: { reference: cached.reference ?? ref, html: cached.html },
            }));
            return;
          }

          // No cached passage yet
          setPassages((prev) => ({ ...prev, [ref]: null }));
          setPassageErrors((prev) => ({
            ...prev,
            [ref]: "Offline: open this passage once while online to cache it.",
          }));
          return;
        }

        // ONLINE: fetch and save into IndexedDB for offline use
        const res = await fetchPassageHtml(ref, bibleId);
        setPassages((prev) => ({ ...prev, [ref]: res }));

        await localPutPassage({
          bibleId,
          ref,
          reference: res.reference ?? ref,
          html: res.html,
          cached_at: Date.now(),
        });
      } catch (e: any) {
        const msg = String(e?.message ?? "Failed to load passage");
        console.error("Passage fetch error:", e);
        setPassages((prev) => ({ ...prev, [ref]: null }));
        setPassageErrors((prev) => ({ ...prev, [ref]: msg }));
      } finally {
        setPassageLoading((prev) => ({ ...prev, [ref]: false }));
      }
    }

    ensureActivePassageLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  function getResponseForKey(key: string) {
    return responses[key] ?? emptyResp4();
  }

  function setResponseForKey(key: string, next: Resp4) {
    setResponses((prev) => ({ ...prev, [key]: next }));
  }

  // ---- guards
  if (loading) return <div>Loading group…</div>;

  if (offlineNeedsOnlineOnce) {
    return (
      <div style={{ padding: 16, color: "rgba(255,255,255,0.92)" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Offline mode</div>
        <div style={{ opacity: 0.85, maxWidth: 520, lineHeight: 1.5 }}>
          This group hasn’t been cached on this device yet.
          <br />
          Go online once, open this group, then you’ll be able to refresh offline.
        </div>
      </div>
    );
  }

  if (!group) return <div>Group not found</div>;

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
  };

  const cardSubtitle: React.CSSProperties = {
    marginTop: 6,
    opacity: 0.8,
    fontSize: 14,
  };

  const pillBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
  };

  // ---- LIST VIEW
  if (!activeSection) {
    return (
      <div style={pageWrap}>
        <h1 style={{ marginBottom: 4 }}>{group.name}</h1>
        <div style={{ opacity: 0.8, marginBottom: 16 }}>
          <div>Start date: {group.start_date}</div>
          <div>Timezone: {group.timezone}</div>
          <div>Role: {role ?? "member"}</div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <Link href="/groups" style={{ opacity: 0.85 }}>
            ← Back to Groups
          </Link>
        </div>

        
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button
            style={pillBtn}
            onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
          >
            ← Prev
          </button>

          <div style={{ fontWeight: 700 }}>
            Week {selectedWeek} / {maxWeek}
          </div>

          <button
            style={pillBtn}
            onClick={() => setSelectedWeek((w) => Math.min(maxWeek, w + 1))}
            disabled={selectedWeek >= maxWeek}
          >
            Next →
          </button>

          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <button style={pillBtn} disabled={savingCompletion || (!isCompleted && !canCompleteLocal)}>
              {isCompleted ? "✅ Completed" : "⬜ Mark week complete"}
            </button>

            {showCompleteHint && (
              <div style={{ marginTop: 4, opacity: 0.8, fontSize: 12 }}>
                (complete all responses to unlock)
              </div>
            )}
          </div>
        </div>

        <div style={surface}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Week {selectedWeek}</div>
          <div style={{ opacity: 0.8, marginBottom: 12 }}>This Week</div>

          {responsesLoading && (
            <div style={{ opacity: 0.8, marginBottom: 12, fontSize: 12 }}>Loading responses…</div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {memoryVerseRef ? (
              <button
                style={cardButton}
                onClick={() =>
                  setActiveSection({
                    kind: "memory",
                    ref: memoryVerseRef,
                    key: sectionKeyFor(selectedWeek, "memory", memoryVerseRef),
                  })
                }
              >
                <div style={{ fontWeight: 800, fontSize: 16, opacity: 0.92 }}>Memory Verse</div>
                <div style={cardSubtitle}>{memoryVerseRef}</div>
                {!isOnline() && (
                  <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                    (offline: opens if cached)
                  </div>
                )}
              </button>
            ) : (
              <div style={{ opacity: 0.75 }}>No memory verse for this week.</div>
            )}

            {readings.slice(0, 5).map((ref, idx) => (
              <button
                key={`${idx}:${ref}`}
                style={cardButton}
                onClick={() =>
                  setActiveSection({
                    kind: "reading",
                    ref,
                    index: idx,
                    key: sectionKeyFor(selectedWeek, "reading", ref, idx),
                  })
                }
              >
                <div style={{ fontWeight: 800, fontSize: 16, opacity: 0.92 }}>Passage {idx + 1}</div>
                <div style={cardSubtitle}>{ref}</div>
                {!isOnline() && (
                  <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                    (offline: opens if cached)
                  </div>
                )}
              </button>
            ))}

            {readings.length === 0 && <div style={{ opacity: 0.75 }}>No passages for this week.</div>}
          </div>
        </div>

       
      </div>
    );
  }

  // ---- DETAIL VIEW
  const activeRef = activeSection.ref;
  const loadingThis = passageLoading[activeRef] === true;
  const passage = passages[activeRef];
  const passageErr = passageErrors[activeRef];
  const isMemory = activeSection.kind === "memory";

  const sectionKey = activeSection.key;
  const resp = getResponseForKey(sectionKey);

  const title =
    activeSection.kind === "memory" ? "Memory Verse" : `Passage ${activeSection.index + 1}`;

  return (
    <div style={pageWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button style={pillBtn} onClick={() => setActiveSection(null)}>
          ← Back
        </button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
          <div style={{ opacity: 0.8 }}>{activeRef}</div>
        </div>
        <div style={{ marginLeft: "auto", opacity: 0.8 }}>
          Week {selectedWeek} / {maxWeek}
        </div>
      </div>

      <div style={surface}>
        <div style={{ marginBottom: 10, fontWeight: 800 }}>Scripture</div>

        {loadingThis && <div>Loading passage…</div>}

        {!loadingThis && passage?.html && (
          <div
            style={{ lineHeight: 1.6, whiteSpace: "normal", color: "rgba(255,255,255,0.92)" }}
            dangerouslySetInnerHTML={{ __html: passage.html }}
          />
        )}

        {!loadingThis && passage === null && (
          <div style={{ color: "salmon" }}>
            Couldn’t load this passage.
            {passageErr ? (
              <div style={{ marginTop: 6, opacity: 0.9, fontSize: 12, whiteSpace: "pre-wrap" }}>
                {passageErr}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!isMemory && (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {(["a", "b", "c", "d"] as const).map((field, i) => {
            const label = RESPONSE_LABELS[i];

            return (
              <div key={field} style={surface}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>
                <textarea
                  value={resp[field]}
                  onChange={(e) => {
                    const value = e.target.value;
                    const next = { ...resp, [field]: value };
                    setResponseForKey(sectionKey, next);

                    const pKey = passageKeyFromIndex(activeSection.index);
                    const rKey = responseKeyFromField(field);
                    scheduleSaveCell(pKey, rKey, value);
                  }}
                  rows={4}
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.25)",
                    color: "rgba(255,255,255,0.92)",
                    padding: 10,
                    outline: "none",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}