import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanInput, findExistingGameId } from "@/lib/server/availability";

type RawBody = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseBody(raw: unknown): { ok: true; body: RawBody } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "Invalid JSON body" };

  const pin = readString(raw.pin).trim();
  const playerName = cleanInput(readString(raw.playerName));
  const status = readString(raw.status);
  const gameRaw = isRecord(raw.game) ? raw.game : null;

  if (!pin) return { ok: false, error: "PIN required" };
  if (playerName.length < 2) return { ok: false, error: "Player name required" };
  if (status !== "yes" && status !== "maybe" && status !== "no") {
    return { ok: false, error: "Invalid status" };
  }
  if (!gameRaw) return { ok: false, error: "Game payload incomplete" };

  const source_key = readString(gameRaw.source_key).trim();
  const kickoff_iso = readString(gameRaw.kickoff_iso).trim();
  const home = cleanInput(readString(gameRaw.home));
  const away = cleanInput(readString(gameRaw.away));
  const venueRaw = gameRaw.venue;
  const venue =
    venueRaw === null || venueRaw === undefined ? null : cleanInput(readString(venueRaw));

  if (!source_key || !kickoff_iso || !home || !away) {
    return { ok: false, error: "Game payload incomplete" };
  }
  if (Number.isNaN(new Date(kickoff_iso).getTime())) {
    return { ok: false, error: "Invalid kickoff ISO" };
  }

  return {
    ok: true,
    body: {
      pin,
      playerName,
      status,
      game: {
        source_key,
        kickoff_iso,
        home,
        away,
        venue,
      },
    },
  };
}

export async function POST(req: Request) {
  const TEAM_PIN = process.env.TEAM_PIN || "briars2026";

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: "error" in parsed ? parsed.error : "Invalid payload" },
      { status: 400 }
    );
  }
  const body = parsed.body;

  if (!body.pin || body.pin !== TEAM_PIN) {
    return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
  }

  const playerName = cleanInput(body.playerName || "");
  if (playerName.length < 2) {
    return NextResponse.json({ ok: false, error: "Player name required" }, { status: 400 });
  }

  const { source_key, kickoff_iso, home, away, venue } = body.game || ({} as any);
  if (!source_key || !kickoff_iso || !home || !away) {
    return NextResponse.json({ ok: false, error: "Game payload incomplete" }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    let gameId = await findExistingGameId(source_key, kickoff_iso, home, away);

    if (!gameId) {
      const { data: gameRow, error: gameErr } = await sb
        .from("games")
        .insert({
          source_key,
          kickoff_iso,
          home: cleanInput(home),
          away: cleanInput(away),
          venue: venue ?? null,
        })
        .select("id")
        .single();

      if (gameErr || !gameRow) {
        return NextResponse.json(
          { ok: false, error: gameErr?.message || "Game insert failed" },
          { status: 500 }
        );
      }

      gameId = gameRow.id;
    } else {
      // Keep existing row fresh
      const { error: updateErr } = await sb
        .from("games")
        .update({
          source_key,
          kickoff_iso,
          home: cleanInput(home),
          away: cleanInput(away),
          venue: venue ?? null,
        })
        .eq("id", gameId);

      if (updateErr) {
        return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
      }
    }

    const { data: playerRow, error: playerErr } = await sb
      .from("players")
      .upsert({ name: playerName }, { onConflict: "name" })
      .select("id")
      .single();

    if (playerErr || !playerRow) {
      return NextResponse.json(
        { ok: false, error: playerErr?.message || "Player upsert failed" },
        { status: 500 }
      );
    }

    const { error: availErr } = await sb
      .from("availability")
      .upsert(
        {
          game_id: gameId,
          player_id: playerRow.id,
          status: body.status,
        },
        { onConflict: "game_id,player_id" }
      );

    if (availErr) {
      return NextResponse.json({ ok: false, error: availErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: { status: body.status } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
