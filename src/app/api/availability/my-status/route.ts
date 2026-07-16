import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { cleanInput, findMatchingGameIds } from "@/lib/server/availability";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sql = getSql();

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
    const playerRows = await sql`select id from players where name = ${playerName} limit 1`;
    const player = playerRows[0];

    if (!player) {
      return NextResponse.json({ ok: true, status: null });
    }

    const gameIds = await findMatchingGameIds(source_key);

    if (!gameIds.length) {
      return NextResponse.json({ ok: true, status: null });
    }

    const rows = await sql`
      select status from availability
      where player_id = ${player.id} and game_id = ANY(${gameIds})
      limit 1`;

    return NextResponse.json({
      ok: true,
      status: rows?.[0]?.status ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
