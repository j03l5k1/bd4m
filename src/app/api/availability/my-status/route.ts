import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function clean(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function parseSourceKey(sourceKey: string) {
  const parts = sourceKey.split("|");
  if (parts.length < 3) return null;

  const kickoffISO = parts[0];
  const home = clean(parts[1] || "");
  const away = clean(parts.slice(2).join("|") || "");

  return { kickoffISO, home, away };
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

    // legacy timezone offsets (Sydney DST / old transforms)
    candidates.add(new Date(d.getTime() + 10 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() + 11 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() - 10 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() - 11 * 60 * 60 * 1000).toISOString());
  }

  return [...candidates];
}

async function findMatchingGameIds(source_key: string) {
  // ✅ supabaseAdmin is now a client, not a function
  const sb = supabaseAdmin;

  const exact = await sb.from("games").select("id").eq("source_key", source_key);
  if (exact.error) throw new Error(exact.error.message);

  const ids = new Set<string>((exact.data || []).map((g: any) => g.id));

  const parsed = parseSourceKey(source_key);
  if (!parsed) return [...ids];

  const isoCandidates = buildLegacyIsoCandidates(parsed.kickoffISO);
  const sourceKeyCandidates = isoCandidates.map((iso) => `${iso}|${parsed.home}|${parsed.away}`);

  const legacy = await sb.from("games").select("id").in("source_key", sourceKeyCandidates);
  if (legacy.error) throw new Error(legacy.error.message);

  for (const row of legacy.data || []) {
    ids.add((row as any).id);
  }

  return [...ids];
}

export async function GET(req: Request) {
  const sb = supabaseAdmin;

  const { searchParams } = new URL(req.url);
  const source_key = searchParams.get("source_key");
  const playerName = clean(searchParams.get("playerName") || "");

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
