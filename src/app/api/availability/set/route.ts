import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
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
    const sql = getSql();
    let gameId = await findExistingGameId(source_key, kickoff_iso, home, away);

    if (!gameId) {
      const gameRows = await sql`
        insert into games (source_key, kickoff_iso, home, away, venue)
        values (${source_key}, ${kickoff_iso}, ${cleanInput(home)}, ${cleanInput(away)}, ${venue ?? null})
        returning id`;

      if (!gameRows[0]?.id) {
        return NextResponse.json({ ok: false, error: "Game insert failed" }, { status: 500 });
      }

      gameId = gameRows[0].id;
    } else {
      // Keep existing row fresh
      await sql`
        update games set
          source_key = ${source_key},
          kickoff_iso = ${kickoff_iso},
          home = ${cleanInput(home)},
          away = ${cleanInput(away)},
          venue = ${venue ?? null}
        where id = ${gameId}`;
    }

    const playerRows = await sql`
      insert into players (name) values (${playerName})
      on conflict (name) do update set name = excluded.name
      returning id`;

    if (!playerRows[0]?.id) {
      return NextResponse.json({ ok: false, error: "Player upsert failed" }, { status: 500 });
    }

    await sql`
      insert into availability (game_id, player_id, status)
      values (${gameId}, ${playerRows[0].id}, ${body.status})
      on conflict (game_id, player_id) do update set status = excluded.status`;

    return NextResponse.json({ ok: true, saved: { status: body.status } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
