import { NextResponse } from "next/server";

const YOUVERSION_BASE_URL =
  "https://api.youversion.com/1.0/bible";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const reference = searchParams.get("ref");
  const version = searchParams.get("version") ?? "ESV";

  if (!reference) {
    return NextResponse.json(
      { error: "Missing ref parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUVERSION_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "YouVersion API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `${YOUVERSION_BASE_URL}/passage.json?reference=${encodeURIComponent(
      reference
    )}&version_id=${version}`;

    const response = await fetch(url, {
      headers: {
        "X-YouVersion-Developer-Token": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "YouVersion error", details: text },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      reference,
      version,
      passages: data.passages ?? [],
    });
  } catch (err) {
    console.error("YouVersion fetch failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}