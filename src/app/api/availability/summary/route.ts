import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source_key = searchParams.get("source_key");

  if (!source_key) {
    return NextResponse.json({ ok: false, error: "Missing source_key" }, { status: 400 });
  }

  // Find game
  const { data: game, error: gameErr } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("source_key", source_key)
    .maybeSingle();

  if (gameErr) return NextResponse.json({ ok: false, error: gameErr.message }, { status: 500 });

  if (!game) {
    // No one has voted yet for this game
    return NextResponse.json({ ok: true, counts: { yes: 0, no: 0, maybe: 0 } });
  }

  // Get all availability rows for game and count on server
  const { data: rows, error: rowsErr } = await supabaseAdmin
    .from("availability")
    .select("status")
    .eq("game_id", game.id);

  if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });

  const counts = { yes: 0, no: 0, maybe: 0 };
  for (const r of rows || []) {
    if (r.status === "yes") counts.yes++;
    if (r.status === "no") counts.no++;
    if (r.status === "maybe") counts.maybe++;
  }

  return NextResponse.json({ ok: true, counts });
}
