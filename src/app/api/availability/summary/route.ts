import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
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

    candidates.add(new Date(d.getTime() + 10 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() + 11 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() - 10 * 60 * 60 * 1000).toISOString());
    candidates.add(new Date(d.getTime() - 11 * 60 * 60 * 1000).toISOString());
  }

  return [...candidates];
}

async function findMatchingGameIds(source_key: string) {
  const exact = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("source_key", source_key);

  if (exact.error) throw new Error(exact.error.message);

  const ids = new Set<string>((exact.data || []).map((g: any) => g.id));

  const parsed = parseSourceKey(source_key);
  if (!parsed) return [...ids];

  const isoCandidates = buildLegacyIsoCandidates(parsed.kickoffISO);
  const sourceKeyCandidates = isoCandidates.map((iso) => `${iso}|${parsed.home}|${parsed.away}`);

  const legacy = await supabaseAdmin
    .from("games")
    .select("id, source_key")
    .in("source_key", sourceKeyCandidates);

  if (legacy.error) throw new Error(legacy.error.message);

  for (const row of legacy.data || []) {
    ids.add((row as any).id);
  }

  return [...ids];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source_key = searchParams.get("source_key");

  if (!source_key) {
    return NextResponse.json({ ok: false, error: "Missing source_key" }, { status: 400 });
  }

  try {
    const gameIds = await findMatchingGameIds(source_key);

    if (!gameIds.length) {
      return NextResponse.json({ ok: true, counts: { yes: 0, no: 0, maybe: 0 } });
    }

    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("availability")
      .select("status")
      .in("game_id", gameIds);

    if (rowsErr) {
      return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });
    }

    const counts = { yes: 0, no: 0, maybe: 0 };

    for (const r of rows || []) {
      if (r.status === "yes") counts.yes++;
      if (r.status === "no") counts.no++;
      if (r.status === "maybe") counts.maybe++;
    }

    return NextResponse.json({ ok: true, counts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
