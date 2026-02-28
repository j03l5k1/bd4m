import { NextResponse } from "next/server";
import { runLegendsIngest } from "@/lib/server/ingestLegends";

export const runtime = "nodejs"; // cheerio wants node

export async function GET(req: Request) {
  // Protect cron route
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret");
  if (!secret || got !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await runLegendsIngest();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, details: "details" in result ? result.details : undefined },
      { status: result.status }
    );
  }
  return NextResponse.json(result);
}
