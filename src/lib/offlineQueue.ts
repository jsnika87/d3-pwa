import { openDB } from "idb";

export type UpsertResponsePayload = {
  group_id: string;
  user_id: string;
  week_number: number;
  passage_key: string; // "p1".."p5"
  response_key: string; // "r1".."r4"
  response_text: string;
};

export type UpsertWeekCompletionPayload = {
  group_id: string;
  user_id: string;
  week_number: number;
  completed_at: string;
};

export type DeleteWeekCompletionPayload = {
  group_id: string;
  user_id: string;
  week_number: number;
};

export type QueueItem =
  | {
      id?: number;
      type: "upsert_response";
      createdAt: number;
      payload: UpsertResponsePayload;
    }
  | {
      id?: number;
      type: "upsert_week_completion";
      createdAt: number;
      payload: UpsertWeekCompletionPayload;
    }
  | {
      id?: number;
      type: "delete_week_completion";
      createdAt: number;
      payload: DeleteWeekCompletionPayload;
    };

// --- offline group + memberships cache types ---
export type OfflineGroup = {
  id: string;
  name: string;
  start_date: string;
  timezone: string;
  invite_code?: string;
};

export type OfflineGroupContext = {
  group_id: string;
  user_id: string;
  role: string;
  group: OfflineGroup;
  cached_at: number;
};

export type OfflineMembership = {
  group_id: string;
  role: string;
  group: OfflineGroup;
};

export type OfflineMembershipsCache = {
  user_id: string;
  items: OfflineMembership[];
  cached_at: number;
};

// --- offline passage cache types ---
export type OfflinePassage = {
  reference: string;
  html: string;
  cached_at: number;
};

const DB_NAME = "d3_offline";
const DB_VERSION = 3;

async function db() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("responses")) {
        db.createObjectStore("responses");
      }

      if (!db.objectStoreNames.contains("group_context")) {
        db.createObjectStore("group_context");
      }
      if (!db.objectStoreNames.contains("memberships")) {
        db.createObjectStore("memberships");
      }

      // ✅ passages cache
      if (!db.objectStoreNames.contains("passages")) {
        // key = bibleId:ref
        db.createObjectStore("passages");
      }
    },
  });
}

/** Call once early in app startup (safe to call multiple times). */
export async function initOfflineDb() {
  await db();
}

function responseKey(
  p: Pick<
    UpsertResponsePayload,
    "group_id" | "user_id" | "week_number" | "passage_key" | "response_key"
  >
) {
  return `${p.group_id}:${p.user_id}:${p.week_number}:${p.passage_key}:${p.response_key}`;
}

function groupContextKey(params: { user_id: string; group_id: string }) {
  return `${params.user_id}:${params.group_id}`;
}

function membershipsKey(user_id: string) {
  return `${user_id}`;
}

function passageKey(bibleId: number, ref: string) {
  return `${bibleId}:${ref}`;
}

/** Local cache so UI can load offline */
export async function localPutResponse(payload: UpsertResponsePayload) {
  const d = await db();
  await d.put("responses", payload.response_text, responseKey(payload));
}

export async function localGetResponses(params: {
  group_id: string;
  user_id: string;
  week_number: number;
}) {
  const d = await db();
  const out: Record<string, string> = {};

  for (let pi = 1; pi <= 5; pi++) {
    for (let ri = 1; ri <= 4; ri++) {
      const k = `${params.group_id}:${params.user_id}:${params.week_number}:p${pi}:r${ri}`;
      const v = await d.get("responses", k);
      if (typeof v === "string") out[k] = v;
    }
  }

  return out;
}

/** Cache a group context so /groups/[groupId] can load offline after refresh */
export async function localPutGroupContext(
  ctx: Omit<OfflineGroupContext, "cached_at"> & { cached_at?: number }
) {
  const d = await db();
  const full: OfflineGroupContext = {
    ...ctx,
    cached_at: typeof ctx.cached_at === "number" ? ctx.cached_at : Date.now(),
  };
  await d.put(
    "group_context",
    full,
    groupContextKey({ user_id: full.user_id, group_id: full.group_id })
  );
}

export async function localGetGroupContext(params: { user_id: string; group_id: string }) {
  const d = await db();
  const v = await d.get("group_context", groupContextKey(params));
  return (v ?? null) as OfflineGroupContext | null;
}

/** Cache memberships list so /groups can load offline after refresh */
export async function localPutMemberships(
  cache: Omit<OfflineMembershipsCache, "cached_at"> & { cached_at?: number }
) {
  const d = await db();
  const full: OfflineMembershipsCache = {
    ...cache,
    cached_at: typeof cache.cached_at === "number" ? cache.cached_at : Date.now(),
  };
  await d.put("memberships", full, membershipsKey(full.user_id));
}

export async function localGetMemberships(user_id: string) {
  const d = await db();
  const v = await d.get("memberships", membershipsKey(user_id));
  return (v ?? null) as OfflineMembershipsCache | null;
}

/**
 * ✅ Aliases to match your current imports in GroupsClient.tsx
 * (so you don’t have to rename your imports everywhere)
 */
export const localPutMembershipsCache = localPutMemberships;
export const localGetMembershipsCache = localGetMemberships;

/** ✅ Cache passage HTML so Memory Verse / Passage pages can open offline */
export async function localPutPassage(params: {
  bibleId: number;
  ref: string;
  reference: string;
  html: string;
  cached_at?: number;
}) {
  const d = await db();
  const full: OfflinePassage = {
    reference: params.reference,
    html: params.html,
    cached_at: typeof params.cached_at === "number" ? params.cached_at : Date.now(),
  };
  await d.put("passages", full, passageKey(params.bibleId, params.ref));
}

export async function localGetPassage(params: { bibleId: number; ref: string }) {
  const d = await db();
  const v = await d.get("passages", passageKey(params.bibleId, params.ref));
  return (v ?? null) as OfflinePassage | null;
}

/** Queue a write to replay later */
export async function enqueue(item: QueueItem) {
  const d = await db();
  await d.add("queue", item);
}

/** Return all queued items in order */
export async function getQueue() {
  const d = await db();
  return (await d.getAll("queue")) as QueueItem[];
}

export async function removeQueueItem(id: number) {
  const d = await db();
  await d.delete("queue", id);
}

export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}