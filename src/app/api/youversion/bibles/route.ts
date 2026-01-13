import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const key = process.env.YVP_APP_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Missing YVP_APP_KEY in .env.local" },
      { status: 500 }
    );
  }

  // Allow overriding language via ?lang=en (defaults to en)
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") || "en";

  // ✅ API requires: language_ranges[] (array param)
  const url = new URL("https://api.youversion.com/v1/bibles");
  url.searchParams.append("language_ranges[]", lang);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-yvp-app-key": key,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "YouVersion error",
          status: res.status,
          contentType,
          details: bodyText.slice(0, 1200),
          url: url.toString(),
        },
        { status: 502 }
      );
    }

    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        {
          error: "YouVersion returned non-JSON",
          status: res.status,
          contentType,
          details: bodyText.slice(0, 1200),
          url: url.toString(),
        },
        { status: 502 }
      );
    }

    // Safe parse
    try {
      const data = JSON.parse(bodyText);
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "YouVersion JSON parse failed",
          contentType,
          details: String(e?.message ?? e),
          rawPreview: bodyText.slice(0, 1200),
          url: url.toString(),
        },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: "YouVersion fetch failed", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}