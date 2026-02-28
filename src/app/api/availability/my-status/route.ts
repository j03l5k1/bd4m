import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanInput, findMatchingGameIds } from "@/lib/server/availability";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sb = getSupabaseAdmin();

  const { searchParams } = new URL(req.url);
  const source_key = searchParams.get("source_key");
  const playerName = cleanInput(searchParams.get("playerName") || "");

  if (!source_key) {
    return NextResponse.json({ ok: false, error: "Missing source_key" }, { status: 400 });
  }

  if (playerName.length < 2) {
    return NextResponse.json({ ok: true, status: null });
  }

  try {
    const { data: player, error: playerErr } = await sb
      .from("players")
      .select("id")
      .eq("name", playerName)
      .maybeSingle();

    if (playerErr) {
      return NextResponse.json({ ok: false, error: playerErr.message }, { status: 500 });
    }

    if (!player) {
      return NextResponse.json({ ok: true, status: null });
    }

    const gameIds = await findMatchingGameIds(source_key);

    if (!gameIds.length) {
      return NextResponse.json({ ok: true, status: null });
    }

    const { data: rows, error: rowsErr } = await sb
      .from("availability")
      .select("status")
      .eq("player_id", player.id)
      .in("game_id", gameIds)
      .limit(1);

    if (rowsErr) {
      return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      status: rows?.[0]?.status ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
