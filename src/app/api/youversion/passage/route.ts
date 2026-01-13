import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, cache: "no-store" });
  const contentType = res.headers.get("content-type") ?? "";

  const raw = await res.text();

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      contentType,
      raw,
      url,
    };
  }

  if (!contentType.includes("application/json")) {
    return {
      ok: false as const,
      status: res.status,
      contentType,
      raw,
      url,
    };
  }

  try {
    const json = JSON.parse(raw);
    return { ok: true as const, status: res.status, json, url };
  } catch {
    return {
      ok: false as const,
      status: res.status,
      contentType,
      raw,
      url,
    };
  }
}

/**
 * IMPORTANT NOTE:
 * YouVersion's Platform API has multiple products/paths depending on your access.
 * This route tries a small set of likely endpoints and returns the first one that works.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const reference = searchParams.get("ref") || searchParams.get("reference");
  const bibleId = Number(searchParams.get("bibleId") || "2692"); // <-- default to 2692
  const version = searchParams.get("versionId"); // optional compatibility

  if (!reference) {
    return NextResponse.json(
      { error: "Missing ref", details: "Provide ?ref=John%203:16" },
      { status: 400 }
    );
  }

  const key = process.env.YVP_APP_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing YVP_APP_KEY in .env.local" },
      { status: 500 }
    );
  }

  // Some environments require the header name exactly like this:
  const headers = {
    "x-yvp-app-key": key,
    accept: "application/json",
  };

  // Try a handful of candidate endpoints.
  // (Your earlier logs show 404/HTML docs, which likely means wrong base/path for your subscription.)
  const refEncoded = encodeURIComponent(reference);

  const candidates: string[] = [];

  // Common patterns people attempt (varies by product/tenant):
  candidates.push(`https://api.youversion.com/v1/bibles/${bibleId}/passage?reference=${refEncoded}`);
  candidates.push(`https://api.youversion.com/v1/bibles/${bibleId}/passages?reference=${refEncoded}`);
  candidates.push(`https://api.youversion.com/v1/bibles/${bibleId}/content?reference=${refEncoded}`);
  candidates.push(`https://api.youversion.com/v1/bibles/${bibleId}/verses?reference=${refEncoded}`);

  // If you still have an old “versionId” flow, try that too (optional):
  if (version) {
    candidates.push(`https://api.youversion.com/v1/bibles/${version}/passage?reference=${refEncoded}`);
  }

  // Some YouVersion tenants use a different host/product; if you have a known host from the Swift build,
  // add it here as an additional candidate.
  // candidates.push(`https://<YOUR_KNOWN_HOST>/v1/bibles/${bibleId}/passage?reference=${refEncoded}`);

  const attempts: any[] = [];

  for (const url of candidates) {
    const out = await fetchJson(url, headers);

    if (!out.ok) {
      attempts.push({
        url: out.url,
        status: out.status,
        contentType: out.contentType,
        preview: (out.raw ?? "").slice(0, 180),
      });
      continue;
    }

    const json: any = out.json;

    // Try to extract HTML/text from likely shapes.
    // YouVersion can return different keys depending on endpoint.
    const html =
      json?.html ??
      json?.data?.html ??
      json?.passage?.html ??
      json?.data?.passage?.html ??
      json?.content ??
      json?.data?.content ??
      null;

    const text =
      json?.text ??
      json?.data?.text ??
      json?.passage?.text ??
      json?.data?.passage?.text ??
      (typeof html === "string" ? stripHtml(html) : null);

    if (typeof html === "string" || typeof text === "string") {
      return NextResponse.json({
        reference,
        bibleId,
        html: typeof html === "string" ? html : null,
        text: typeof text === "string" ? text : null,
        raw: json, // keep for debugging; remove later if you want
      });
    }

    // If we got JSON but couldn't interpret it, include shape in attempts and continue.
    attempts.push({
      url,
      status: out.status,
      contentType: "application/json",
      preview: JSON.stringify(json).slice(0, 180),
    });
  }

  return NextResponse.json(
    {
      error: "YouVersion passage fetch failed for all candidate endpoints",
      bibleId,
      reference,
      attempts,
    },
    { status: 502 }
  );
}