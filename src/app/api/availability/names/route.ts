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
    return NextResponse.json({
      ok: true,
      names: { yes: [], maybe: [], no: [] },
    });
  }

  // Join availability -> players
  const { data: rows, error: rowsErr } = await supabaseAdmin
    .from("availability")
    .select("status, players(name)")
    .eq("game_id", game.id);

  if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });

  const names = { yes: [] as string[], maybe: [] as string[], no: [] as string[] };

  for (const r of rows || []) {
    const name = (r as any)?.players?.name;
    if (!name) continue;
    if (r.status === "yes") names.yes.push(name);
    if (r.status === "maybe") names.maybe.push(name);
    if (r.status === "no") names.no.push(name);
  }

  // Nice stable ordering
  names.yes.sort((a, b) => a.localeCompare(b));
  names.maybe.sort((a, b) => a.localeCompare(b));
  names.no.sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ ok: true, names });
}
