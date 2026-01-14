// src/app/api/youversion/verses/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ResolveResult = {
  ref: string;
  bibleId: number;
  usfm: string; // first successful usfm id (or the requested one if single)
  youversion: {
    id: string;
    reference?: string;
    content?: string; // html
  };
  parts?: Array<{
    ref: string;
    usfmTried: string[];
    ok: boolean;
    chosenUsfm?: string;
    youversionReference?: string;
  }>;
};

/**
 * Full Bible book mapping → USFM
 * (added common misspellings like "Galations")
 */
const BOOK_USFM: Record<string, string> = {
  // OT
  genesis: "GEN",
  gen: "GEN",
  exodus: "EXO",
  exo: "EXO",
  exod: "EXO",
  leviticus: "LEV",
  lev: "LEV",
  numbers: "NUM",
  num: "NUM",
  deuteronomy: "DEU",
  deut: "DEU",
  deuter: "DEU",
  joshua: "JOS",
  jos: "JOS",
  judges: "JDG",
  jdg: "JDG",
  ruth: "RUT",
  rut: "RUT",
  "1 samuel": "1SA",
  "2 samuel": "2SA",
  "1sa": "1SA",
  "2sa": "2SA",
  "1 kings": "1KI",
  "2 kings": "2KI",
  "1ki": "1KI",
  "2ki": "2KI",
  "1 chronicles": "1CH",
  "2 chronicles": "2CH",
  "1ch": "1CH",
  "2ch": "2CH",
  ezra: "EZR",
  ezr: "EZR",
  nehemiah: "NEH",
  neh: "NEH",
  esther: "EST",
  est: "EST",
  job: "JOB",
  psalms: "PSA",
  psalm: "PSA",
  psa: "PSA",
  ps: "PSA",
  proverbs: "PRO",
  prov: "PRO",
  pro: "PRO",
  ecclesiastes: "ECC",
  eccles: "ECC",
  ecc: "ECC",
  song: "SNG",
  "song of solomon": "SNG",
  "song of songs": "SNG",
  canticles: "SNG",
  isaiah: "ISA",
  isa: "ISA",
  jeremiah: "JER",
  jer: "JER",
  lamentations: "LAM",
  lam: "LAM",
  ezekiel: "EZK",
  ezek: "EZK",
  ezk: "EZK",
  daniel: "DAN",
  dan: "DAN",
  hosea: "HOS",
  hos: "HOS",
  joel: "JOL",
  jol: "JOL",
  amos: "AMO",
  amo: "AMO",
  obadiah: "OBA",
  oba: "OBA",
  jonah: "JON",
  jon: "JON",
  micah: "MIC",
  mic: "MIC",
  nahum: "NAM",
  nah: "NAM",
  habakkuk: "HAB",
  hab: "HAB",
  zephaniah: "ZEP",
  zeph: "ZEP",
  zep: "ZEP",
  haggai: "HAG",
  hag: "HAG",
  zechariah: "ZEC",
  zec: "ZEC",
  zach: "ZEC",
  malachi: "MAL",
  mal: "MAL",

  // NT
  matthew: "MAT",
  matt: "MAT",
  mt: "MAT",
  mark: "MRK",
  mrk: "MRK",
  mk: "MRK",
  luke: "LUK",
  luk: "LUK",
  lk: "LUK",
  john: "JHN",
  jhn: "JHN",
  jn: "JHN",
  acts: "ACT",
  act: "ACT",
  romans: "ROM",
  rom: "ROM",
  "1 corinthians": "1CO",
  "2 corinthians": "2CO",
  "1corinthians": "1CO",
  "2corinthians": "2CO",
  "1 co": "1CO",
  "2 co": "2CO",
  "1co": "1CO",
  "2co": "2CO",

  galatians: "GAL",
  gal: "GAL",
  // ✅ common misspelling in your data
  galations: "GAL",

  ephesians: "EPH",
  eph: "EPH",
  philippians: "PHP",
  phil: "PHP",
  php: "PHP",
  colossians: "COL",
  col: "COL",
  "1 thessalonians": "1TH",
  "2 thessalonians": "2TH",
  "1thessalonians": "1TH",
  "2thessalonians": "2TH",
  "1 thess": "1TH",
  "2 thess": "2TH",
  "1th": "1TH",
  "2th": "2TH",
  "1 timothy": "1TI",
  "2 timothy": "2TI",
  "1timothy": "1TI",
  "2timothy": "2TI",
  "1 ti": "1TI",
  "2 ti": "2TI",
  titus: "TIT",
  tit: "TIT",
  philemon: "PHM",
  phm: "PHM",
  hebrews: "HEB",
  heb: "HEB",
  james: "JAS",
  jas: "JAS",
  "1 peter": "1PE",
  "2 peter": "2PE",
  "1peter": "1PE",
  "2peter": "2PE",
  "1 pe": "1PE",
  "2 pe": "2PE",
  "1 john": "1JN",
  "2 john": "2JN",
  "3 john": "3JN",
  "1john": "1JN",
  "2john": "2JN",
  "3john": "3JN",
  jude: "JUD",
  jud: "JUD",
  revelation: "REV",
  rev: "REV",
};

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeBookKey(s: string) {
  return normalizeSpaces(s)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\bfirst\b/g, "1")
    .replace(/\bsecond\b/g, "2")
    .replace(/\bthird\b/g, "3")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bookToUsfm(bookRaw: string): string | null {
  const raw = normalizeSpaces(bookRaw);

  // Already USFM book code like "GAL", "1CO"
  if (/^(?:[1-3])?[A-Z]{2,3}$/.test(raw)) return raw;

  const cleaned = normalizeBookKey(raw);

  if (BOOK_USFM[cleaned]) return BOOK_USFM[cleaned];

  const m = cleaned.match(/^([1-3])\s*(.+)$/);
  if (m) {
    const key = `${m[1]} ${m[2]}`.trim();
    if (BOOK_USFM[key]) return BOOK_USFM[key];

    const key2 = `${m[1]}${m[2]}`.replace(/\s+/g, "");
    if (BOOK_USFM[key2]) return BOOK_USFM[key2];
  }

  return null;
}

type ParsedRef = {
  bookUsfm: string;
  chapterStart: number;
  verseStart?: number;
  chapterEnd?: number;
  verseEnd?: number;
};

function parseReferenceToParsed(ref: string): ParsedRef | null {
  const raw = normalizeSpaces(ref);

  // "Book 1" or "Book 1:2" or "Book 1:2-4" or "Book 1:2-2:3" or "Book 5-6"
  const match = raw.match(
    /^(.+?)\s+(\d+)(?::([\d]+))?(?:\s*-\s*(\d+)?(?::([\d]+))?)?$/
  );

  if (!match) {
    // Already USFM-like "COL.1" etc
    const u = raw.toUpperCase();
    if (/^[1-3]?[A-Z]{2,3}\.\d+/.test(u)) {
      const [book, rest] = u.split(".", 2);
      const ch = Number(rest?.split(/[.-]/)[0] ?? 1);
      return { bookUsfm: book, chapterStart: ch };
    }
    return null;
  }

  const bookRaw = match[1];
  const bookUsfm = bookToUsfm(bookRaw);
  if (!bookUsfm) return null;

  const chapterStart = Number(match[2]);
  const verseStart = match[3] ? Number(match[3]) : undefined;

  let chapterEnd: number | undefined;
  let verseEnd: number | undefined;

  if (match[4] !== undefined) {
    if (verseStart !== undefined) {
      // "Col 1:15-17" OR "Col 1:15-2:3"
      if (match[5] !== undefined) {
        chapterEnd = Number(match[4]);
        verseEnd = Number(match[5]);
      } else {
        verseEnd = Number(match[4]);
      }
    } else {
      // ✅ "Galatians 5-6" (chapter range)
      chapterEnd = Number(match[4]);
    }
  }

  return { bookUsfm, chapterStart, verseStart, chapterEnd, verseEnd };
}

function isCrossChapterVerseRange(ref: string):
  | { isCross: false }
  | {
      isCross: true;
      bookUsfm: string;
      chapterStart: number;
      verseStart: number;
      chapterEnd: number;
      verseEnd: number;
    } {
  const parsed = parseReferenceToParsed(ref);
  if (!parsed) return { isCross: false };

  const { bookUsfm, chapterStart, verseStart, chapterEnd, verseEnd } = parsed;

  if (
    verseStart === undefined ||
    chapterEnd === undefined ||
    verseEnd === undefined ||
    chapterEnd === chapterStart
  ) {
    return { isCross: false };
  }

  return {
    isCross: true,
    bookUsfm,
    chapterStart,
    verseStart,
    chapterEnd,
    verseEnd,
  };
}

function buildCandidatePassageIds(ref: string): { usfm: string; candidates: string[] } | null {
  const raw = normalizeSpaces(ref);

  // If already passed "LUK.1" or "COL.1.15-17", try as-is too
  const maybeUsfm = raw.toUpperCase();
  const looksUsfm = /^[1-3]?[A-Z]{2,3}\.\d+/.test(maybeUsfm);
  if (looksUsfm) return { usfm: maybeUsfm, candidates: [maybeUsfm] };

  const parsed = parseReferenceToParsed(raw);
  if (!parsed) return null;

  const { bookUsfm, chapterStart, verseStart, chapterEnd, verseEnd } = parsed;

  // ✅ Chapter range (no verses): "GAL 5-6"
  if (!verseStart && chapterEnd && chapterEnd !== chapterStart) {
    const candidates: string[] = [
      `${bookUsfm}.${chapterStart}-${chapterEnd}`,
      `${bookUsfm}.${chapterStart}-${bookUsfm}.${chapterEnd}`,
    ];
    return { usfm: candidates[0], candidates };
  }

  // Chapter only
  if (!verseStart) {
    const usfm = `${bookUsfm}.${chapterStart}`;
    return { usfm, candidates: [usfm] };
  }

  // Single verse
  if (verseStart && !verseEnd && !chapterEnd) {
    const usfm = `${bookUsfm}.${chapterStart}.${verseStart}`;
    return { usfm, candidates: [usfm] };
  }

  // Verse ranges
  const chEnd = chapterEnd ?? chapterStart;
  const vEnd = verseEnd ?? verseStart;

  const candidates: string[] = [];

  if (chEnd === chapterStart) {
    candidates.push(`${bookUsfm}.${chapterStart}.${verseStart}-${vEnd}`);
    candidates.push(`${bookUsfm}.${chapterStart}.${verseStart}-${bookUsfm}.${chapterStart}.${vEnd}`);
  } else {
    candidates.push(`${bookUsfm}.${chapterStart}.${verseStart}-${chEnd}.${vEnd}`);
    candidates.push(`${bookUsfm}.${chapterStart}.${verseStart}-${bookUsfm}.${chEnd}.${vEnd}`);
  }

  return { usfm: candidates[0], candidates };
}

async function yvFetchJson(url: string, appKey: string) {
  const res = await fetch(url, {
    headers: {
      "x-yvp-app-key": appKey,
      accept: "application/json",
    },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  let json: any = null;
  if (contentType.includes("application/json")) {
    try {
      json = JSON.parse(text);
    } catch {}
  }

  return { res, contentType, text, json };
}

function splitCompoundRefs(input: string): string[] {
  const raw = normalizeSpaces(input);

  const commaParts = raw.split(",").map((p) => p.trim()).filter(Boolean);

  const parts: string[] = [];
  for (const p of commaParts) {
    const sub = p
      .split(/\s+(?:&|and)\s+/i)
      .map((x) => x.trim())
      .filter(Boolean);
    parts.push(...sub);
  }

  const out: string[] = [];
  let lastBook: string | null = null;
  let lastChapter: string | null = null;

  for (const p of parts) {
    const part = normalizeSpaces(p);

    const hasBook = /^[A-Za-z]/.test(part) || /^[1-3]\s*[A-Za-z]/.test(part);

    if (hasBook) {
      out.push(part);

      const mBookChap = part.match(/^(.+?)\s+(\d+)/);
      if (mBookChap) {
        lastBook = normalizeSpaces(mBookChap[1]);
        lastChapter = mBookChap[2];
      }
      continue;
    }

    if (/^\d/.test(part) && lastBook) {
      out.push(`${lastBook} ${part}`);
      const mChap = part.match(/^(\d+)(?::|$)/);
      if (mChap) lastChapter = mChap[1];
      continue;
    }

    if (/^\d+(?:-\d+)?$/.test(part) && lastBook && lastChapter) {
      out.push(`${lastBook} ${lastChapter}:${part}`);
      continue;
    }

    out.push(part);
  }

  return out;
}

// Verse trimming helpers
type VerseMarker = { v: number; idx: number };

function findVerseMarkers(html: string): VerseMarker[] {
  const re = /<span class="yv-v" v="(\d+)"><\/span>/g;
  const markers: VerseMarker[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    markers.push({ v: Number(m[1]), idx: m.index });
  }
  return markers;
}

function trimChapterHtmlToRange(html: string, startVerse: number, endVerse?: number): string {
  const markers = findVerseMarkers(html);
  if (markers.length === 0) return html;

  const start =
    markers.find((m) => m.v === startVerse) ?? markers.find((m) => m.v > startVerse);
  if (!start) return html;

  let endIdxExclusive = html.length;

  if (endVerse !== undefined) {
    const afterEnd =
      markers.find((m) => m.v === endVerse + 1) ?? markers.find((m) => m.v > endVerse);
    if (afterEnd) endIdxExclusive = afterEnd.idx;
  }

  const sliced = html.slice(start.idx, endIdxExclusive);
  return `<div>${sliced}</div>`;
}

type FetchSingleOk = {
  ok: true;
  ref: string;
  chosenUsfm: string;
  usfmTried: string[];
  youversionReference: string;
  html: string;
  attempts?: Array<{ url: string; status: number; contentType: string; preview: string }>;
};

type FetchSingleErr = {
  ok: false;
  ref: string;
  usfmTried: string[];
  error: { status: number; message: string };
  attempts?: Array<{ url: string; status: number; contentType: string; preview: string }>;
};

type FetchSingleResult = FetchSingleOk | FetchSingleErr;

async function fetchByPassageId(
  passageId: string,
  refForError: string,
  bibleId: number,
  appKey: string
): Promise<
  | { ok: true; reference: string; content: string; attempt: { url: string; status: number; contentType: string; preview: string } }
  | { ok: false; status: number; message: string; attempt: { url: string; status: number; contentType: string; preview: string } }
> {
  const url = `https://api.youversion.com/v1/bibles/${bibleId}/passages/${encodeURIComponent(
    passageId
  )}?format=html`;

  const { res, contentType, text, json } = await yvFetchJson(url, appKey);

  const attempt = {
    url,
    status: res.status,
    contentType,
    preview: text.slice(0, 200),
  };

  if (!res.ok) {
    const msg =
      (json?.message as string | undefined) ||
      (json?.error as string | undefined) ||
      `Bible passage ${passageId} for version ${bibleId} not found`;
    return { ok: false, status: res.status, message: msg, attempt };
  }

  const data = json?.data ?? json;
  const reference = (data?.reference as string | undefined) ?? refForError;
  const content = data?.content as string | undefined;

  if (!content) {
    return { ok: false, status: 502, message: "Passage response missing content", attempt };
  }

  return { ok: true, reference, content, attempt };
}

function parsedToDisplayRef(p: ParsedRef): string | null {
  const bookName = p.bookUsfm; // fine; caller can still show original ref
  const c1 = p.chapterStart;
  const v1 = p.verseStart;
  const c2 = p.chapterEnd;
  const v2 = p.verseEnd;

  if (!v1) {
    if (c2 && c2 !== c1) return `${bookName} ${c1}-${c2}`;
    return `${bookName} ${c1}`;
  }

  if (!c2 && !v2) return `${bookName} ${c1}:${v1}`;

  const endC = c2 ?? c1;
  const endV = v2 ?? v1;

  if (endC === c1) return `${bookName} ${c1}:${v1}-${endV}`;

  return `${bookName} ${c1}:${v1}-${endC}:${endV}`;
}

async function fetchPassageHtmlSingle(
  ref: string,
  bibleId: number,
  appKey: string
): Promise<FetchSingleResult> {
  const built = buildCandidatePassageIds(ref);
  if (!built) {
    return {
      ok: false,
      ref,
      usfmTried: [],
      error: { status: 400, message: "Could not parse ref" },
    };
  }

  const { candidates } = built;
  const attempts: Array<{ url: string; status: number; contentType: string; preview: string }> = [];

  // Try direct candidates first
  for (const passageId of candidates) {
    const fetched = await fetchByPassageId(passageId, ref, bibleId, appKey);
    attempts.push(fetched.attempt);

    if (fetched.ok) {
      return {
        ok: true,
        ref,
        chosenUsfm: passageId,
        usfmTried: candidates,
        youversionReference: fetched.reference,
        html: fetched.content,
        attempts,
      };
    }
  }

  // Fallbacks
  const parsed = parseReferenceToParsed(ref);
  if (parsed) {
    const { bookUsfm, chapterStart, verseStart, chapterEnd, verseEnd } = parsed;

    // ✅ Chapter range fallback: fetch both chapters & combine
    if (!verseStart && chapterEnd && chapterEnd !== chapterStart) {
      const blocks: string[] = [];

      for (let ch = chapterStart; ch <= chapterEnd; ch++) {
        const chapId = `${bookUsfm}.${ch}`;
        const fetchedChap = await fetchByPassageId(chapId, ref, bibleId, appKey);
        attempts.push(fetchedChap.attempt);

        if (!fetchedChap.ok) {
          return {
            ok: false,
            ref,
            usfmTried: candidates,
            error: { status: fetchedChap.status, message: fetchedChap.message },
            attempts,
          };
        }

        blocks.push(
          `<div style="margin:10px 0 6px;font-weight:700;">${escapeHtml(bookUsfm)} ${ch}</div>${fetchedChap.content}`
        );
      }

      return {
        ok: true,
        ref,
        chosenUsfm: `${bookUsfm}.${chapterStart}-${chapterEnd}`,
        usfmTried: candidates,
        youversionReference: parsedToDisplayRef(parsed) ?? ref,
        html: `<div>${blocks.join("")}</div>`,
        attempts,
      };
    }

    // Same-chapter verse range fallback: fetch chapter and trim
    if (verseStart !== undefined && (chapterEnd === undefined || chapterEnd === chapterStart)) {
      const chapId = `${bookUsfm}.${chapterStart}`;
      const fetchedChap = await fetchByPassageId(chapId, ref, bibleId, appKey);
      attempts.push(fetchedChap.attempt);

      if (fetchedChap.ok) {
        const trimmed = trimChapterHtmlToRange(fetchedChap.content, verseStart, verseEnd);
        return {
          ok: true,
          ref,
          chosenUsfm: chapId,
          usfmTried: candidates,
          youversionReference: fetchedChap.reference,
          html: trimmed,
          attempts,
        };
      }
    }

    // Cross-chapter verse range fallback
    const cross = isCrossChapterVerseRange(ref);
    if (cross.isCross) {
      const startChapId = `${cross.bookUsfm}.${cross.chapterStart}`;
      const endChapId = `${cross.bookUsfm}.${cross.chapterEnd}`;

      const a = await fetchByPassageId(startChapId, ref, bibleId, appKey);
      attempts.push(a.attempt);
      if (!a.ok) {
        return {
          ok: false,
          ref,
          usfmTried: candidates,
          error: { status: a.status, message: a.message },
          attempts,
        };
      }

      const b = await fetchByPassageId(endChapId, ref, bibleId, appKey);
      attempts.push(b.attempt);
      if (!b.ok) {
        return {
          ok: false,
          ref,
          usfmTried: candidates,
          error: { status: b.status, message: b.message },
          attempts,
        };
      }

      const trimmedA = trimChapterHtmlToRange(a.content, cross.verseStart);
      const trimmedB = trimChapterHtmlToRange(b.content, 1, cross.verseEnd);

      return {
        ok: true,
        ref,
        chosenUsfm: `${startChapId}+${endChapId}`,
        usfmTried: candidates,
        youversionReference: ref,
        html: `<div>${trimmedA}${trimmedB}</div>`,
        attempts,
      };
    }
  }

  return {
    ok: false,
    ref,
    usfmTried: candidates,
    error: { status: 404, message: `Bible passage not found for version ${bibleId}` },
    attempts,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const ref = searchParams.get("ref") ?? "";
  const bibleIdStr = searchParams.get("bibleId") ?? "";
  const bibleId = Number(bibleIdStr);

  if (!ref) return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  if (!bibleIdStr || Number.isNaN(bibleId))
    return NextResponse.json({ error: "Missing/invalid bibleId" }, { status: 400 });

  const appKey = process.env.YVP_APP_KEY;
  if (!appKey) {
    return NextResponse.json({ error: "Missing YVP_APP_KEY in .env.local" }, { status: 500 });
  }

  const parts = splitCompoundRefs(ref);

  if (parts.length === 1) {
    const single = await fetchPassageHtmlSingle(parts[0], bibleId, appKey);

    if (!single.ok) {
      return NextResponse.json(
        { error: single.error.message, ref: parts[0] },
        { status: single.error.status }
      );
    }

    const result: ResolveResult = {
      ref,
      bibleId,
      usfm: single.chosenUsfm,
      youversion: {
        id: single.chosenUsfm,
        reference: single.youversionReference,
        content: single.html,
      },
      parts: [
        {
          ref: single.ref,
          usfmTried: single.usfmTried,
          ok: true,
          chosenUsfm: single.chosenUsfm,
          youversionReference: single.youversionReference,
        },
      ],
    };

    return NextResponse.json(result);
  }

  // Multiple parts: fetch each and combine
  const combinedHtmlBlocks: string[] = [];
  const debugParts: ResolveResult["parts"] = [];

  for (const p of parts) {
    const resOne = await fetchPassageHtmlSingle(p, bibleId, appKey);

    if (!resOne.ok) {
      debugParts.push({ ref: p, usfmTried: resOne.usfmTried, ok: false });

      return NextResponse.json(
        {
          error: "Could not load one of the compound references",
          ref,
          failedPart: p,
          details: resOne.error,
          parts,
        },
        { status: resOne.error.status === 400 ? 400 : 502 }
      );
    }

    debugParts.push({
      ref: p,
      usfmTried: resOne.usfmTried,
      ok: true,
      chosenUsfm: resOne.chosenUsfm,
      youversionReference: resOne.youversionReference,
    });

    const heading = `<div style="margin:12px 0 6px;font-weight:700;">${escapeHtml(
      resOne.youversionReference ?? p
    )}</div>`;
    combinedHtmlBlocks.push(`${heading}${resOne.html}`);
  }

  const chosenFirst = debugParts.find((x) => x.ok)?.chosenUsfm ?? "UNKNOWN";

  const result: ResolveResult = {
    ref,
    bibleId,
    usfm: chosenFirst,
    youversion: {
      id: chosenFirst,
      reference: ref,
      content: `<div>${combinedHtmlBlocks.join("")}</div>`,
    },
    parts: debugParts,
  };

  return NextResponse.json(result);
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}