import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findMatchingGameIds } from "@/lib/server/availability";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source_key = searchParams.get("source_key");

  if (!source_key) {
    return NextResponse.json({ ok: false, error: "Missing source_key" }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const gameIds = await findMatchingGameIds(source_key);

    if (!gameIds.length) {
      return NextResponse.json({ ok: true, counts: { yes: 0, no: 0, maybe: 0 } });
    }

    const { data: rows, error: rowsErr } = await sb
      .from("availability")
      .select("status, player_id")
      .in("game_id", gameIds);

    if (rowsErr) {
      return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });
    }

    const counts = { yes: 0, no: 0, maybe: 0 };
    const seen = {
      yes: new Set<string>(),
      maybe: new Set<string>(),
      no: new Set<string>(),
    };

    for (const r of rows || []) {
      const playerId = String((r as any).player_id || "").trim();
      if (!playerId) continue;

      if (r.status === "yes" && !seen.yes.has(playerId)) {
        seen.yes.add(playerId);
        counts.yes++;
      }
      if (r.status === "no" && !seen.no.has(playerId)) {
        seen.no.add(playerId);
        counts.no++;
      }
      if (r.status === "maybe" && !seen.maybe.has(playerId)) {
        seen.maybe.add(playerId);
        counts.maybe++;
      }
    }

    return NextResponse.json({ ok: true, counts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
