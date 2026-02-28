import { NextResponse } from "next/server";
import { runLegendsIngest } from "@/lib/server/ingestLegends";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ secret: string }> }) {
  // ✅ path secret auth
  const { secret } = await ctx.params;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
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
