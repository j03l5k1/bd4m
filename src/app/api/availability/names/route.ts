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
    // Current ISO
    candidates.add(d.toISOString());

    // Legacy "naive local parsed as UTC-ish" variant that old code likely produced
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mi = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");

    candidates.add(new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`).toISOString());

    // +10h / +11h alternates in case older rows were created with Sydney offset mishandled
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
      return NextResponse.json({
        ok: true,
        names: { yes: [], maybe: [], no: [] },
      });
    }

    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("availability")
      .select("status, players(name)")
      .in("game_id", gameIds);

    if (rowsErr) {
      return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 500 });
    }

    const names = {
      yes: [] as string[],
      maybe: [] as string[],
      no: [] as string[],
    };

    const seen = {
      yes: new Set<string>(),
      maybe: new Set<string>(),
      no: new Set<string>(),
    };

    for (const r of rows || []) {
      const name = clean((r as any)?.players?.name || "");
      if (!name) continue;

      if (r.status === "yes" && !seen.yes.has(name)) {
        seen.yes.add(name);
        names.yes.push(name);
      }

      if (r.status === "maybe" && !seen.maybe.has(name)) {
        seen.maybe.add(name);
        names.maybe.push(name);
      }

      if (r.status === "no" && !seen.no.has(name)) {
        seen.no.add(name);
        names.no.push(name);
      }
    }

    names.yes.sort((a, b) => a.localeCompare(b));
    names.maybe.sort((a, b) => a.localeCompare(b));
    names.no.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ ok: true, names });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
