import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";

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

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function buildLegacyIsoCandidates(kickoffISO: string) {
  const candidates = new Set<string>();
  candidates.add(kickoffISO);

  const d = new Date(kickoffISO);
  if (!Number.isNaN(d.getTime())) {
    candidates.add(d.toISOString());

    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mi = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");

    candidates.add(new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`).toISOString());

    candidates.add(new Date(d.getTime() + 10 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() + 11 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() - 10 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() - 11 * 60 * 60 * 1000).toISOString());
  }

  return [...candidates];
}

async function findExistingGameId(source_key: string, kickoff_iso: string, home: string, away: string) {
  const exact = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("source_key", source_key)
    .maybeSingle();

  if (exact.error) throw new Error(exact.error.message);
  if (exact.data?.id) return exact.data.id as string;

  const isoCandidates = buildLegacyIsoCandidates(kickoff_iso);
  const sourceKeyCandidates = isoCandidates.map((iso) => `${iso}|${clean(home)}|${clean(away)}`);

  const legacy = await supabaseAdmin
    .from("games")
    .select("id, kickoff_iso")
    .in("source_key", sourceKeyCandidates)
    .limit(1)
    .maybeSingle();

  if (legacy.error) throw new Error(legacy.error.message);
  if (legacy.data?.id) return legacy.data.id as string;

  return null;
}

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

  const playerName = clean(body.playerName || "");
  if (playerName.length < 2) {
    return NextResponse.json({ ok: false, error: "Player name required" }, { status: 400 });
  }

  const { source_key, kickoff_iso, home, away, venue } = body.game || ({} as any);
  if (!source_key || !kickoff_iso || !home || !away) {
    return NextResponse.json({ ok: false, error: "Game payload incomplete" }, { status: 400 });
  }

  try {
    let gameId = await findExistingGameId(source_key, kickoff_iso, home, away);

    if (!gameId) {
      const { data: gameRow, error: gameErr } = await supabaseAdmin
        .from("games")
        .insert({
          source_key,
          kickoff_iso,
          home: clean(home),
          away: clean(away),
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
      const { error: updateErr } = await supabaseAdmin
        .from("games")
        .update({
          source_key,
          kickoff_iso,
          home: clean(home),
          away: clean(away),
          venue: venue ?? null,
        })
        .eq("id", gameId);

      if (updateErr) {
        return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
      }
    }

    const { data: playerRow, error: playerErr } = await supabaseAdmin
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

    const { error: availErr } = await supabaseAdmin
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
