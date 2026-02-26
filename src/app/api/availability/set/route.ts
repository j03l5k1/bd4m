import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type Body = {
  pin: string;
  playerName: string;
  game: {
    source_key: string;
    kickoff_iso: string;
    home: string;
    away: string;
    venue?: string | null;
  };
  status: "yes" | "no" | "maybe";
};

export async function POST(req: Request) {
  const TEAM_PIN = process.env.TEAM_PIN || "briars2026";

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pin || body.pin !== TEAM_PIN) {
    return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
  }

  const playerName = (body.playerName || "").trim();
  if (playerName.length < 2) {
    return NextResponse.json({ ok: false, error: "Player name required" }, { status: 400 });
  }

  const { source_key, kickoff_iso, home, away, venue } = body.game || ({} as any);
  if (!source_key || !kickoff_iso || !home || !away) {
    return NextResponse.json({ ok: false, error: "Game payload incomplete" }, { status: 400 });
  }

  // 1) Upsert game by source_key
  const { data: gameRow, error: gameErr } = await supabaseAdmin
    .from("games")
    .upsert(
      {
        source_key,
        kickoff_iso,
        home,
        away,
        venue: venue ?? null,
      },
      { onConflict: "source_key" }
    )
    .select("id")
    .single();

  if (gameErr || !gameRow) {
    return NextResponse.json({ ok: false, error: gameErr?.message || "Game upsert failed" }, { status: 500 });
  }

  // 2) Upsert player by name
  const { data: playerRow, error: playerErr } = await supabaseAdmin
    .from("players")
    .upsert({ name: playerName }, { onConflict: "name" })
    .select("id")
    .single();

  if (playerErr || !playerRow) {
    return NextResponse.json({ ok: false, error: playerErr?.message || "Player upsert failed" }, { status: 500 });
  }

  // 3) Upsert availability (unique on game_id + player_id)
  const { error: availErr } = await supabaseAdmin
    .from("availability")
    .upsert(
      {
        game_id: gameRow.id,
        player_id: playerRow.id,
        status: body.status,
      },
      { onConflict: "game_id,player_id" }
    );

  if (availErr) {
    return NextResponse.json({ ok: false, error: availErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
