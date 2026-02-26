import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET() {
  const cached = await kv.get<any>("briars:fixtures");

  if (!cached) {
    // If KV is empty (first deploy), tell user how to warm it:
    return NextResponse.json(
      {
        ok: false,
        error: "No cached data yet. Hit /api/cron/refresh once to populate.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(cached);
}
