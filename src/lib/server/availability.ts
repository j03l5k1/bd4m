import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export function cleanInput(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

type ParsedLegacySourceKey = {
  kind: "legacy";
  kickoffISO: string;
  home: string;
  away: string;
};

type ParsedModernSourceKey = {
  kind: "modern";
  date: string;
  time: string;
  home: string;
  away: string;
  venue: string;
};

function parseSourceKey(sourceKey: string) {
  const parts = sourceKey.split("|");
  if (parts.length >= 5 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(parts[0] || "")) {
    const date = cleanInput(parts[0] || "");
    const time = cleanInput(parts[1] || "");
    const home = cleanInput(parts[2] || "");
    const away = cleanInput(parts[3] || "");
    const venue = cleanInput(parts.slice(4).join("|") || "");

    if (!date || !time || !home || !away) return null;
    return { kind: "modern", date, time, home, away, venue } satisfies ParsedModernSourceKey;
  }

  if (parts.length < 3) return null;

  const kickoffISO = parts[0];
  const home = cleanInput(parts[1] || "");
  const away = cleanInput(parts.slice(2).join("|") || "");

  return { kind: "legacy", kickoffISO, home, away } satisfies ParsedLegacySourceKey;
}

export function buildLegacyIsoCandidates(kickoffISO: string) {
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

function buildSydneyKickoffIsoCandidates(dateStr: string, timeStr: string) {
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  const [hour = 0, minute = 0, second = 0] = timeStr.split(":").map(Number);

  if (
    !Number.isFinite(dd) ||
    !Number.isFinite(mm) ||
    !Number.isFinite(yyyy) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return [];
  }

  const localDateTime = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  const candidates = new Set<string>();

  for (const offset of ["+10:00", "+11:00"]) {
    const d = new Date(`${localDateTime}${offset}`);
    if (!Number.isNaN(d.getTime())) {
      candidates.add(d.toISOString());
    }
  }

  return [...candidates];
}

export async function findMatchingGameIds(sourceKey: string) {
  const sb = getSupabaseAdmin();
  const exact = await sb
    .from("games")
    .select("id")
    .eq("source_key", sourceKey);

  if (exact.error) throw new Error(exact.error.message);

  const ids = new Set<string>((exact.data || []).map((row: any) => row.id));

  const parsed = parseSourceKey(sourceKey);
  if (!parsed) return [...ids];

  if (parsed.kind === "modern") {
    const kickoffCandidates = buildSydneyKickoffIsoCandidates(parsed.date, parsed.time);
    if (!kickoffCandidates.length) return [...ids];

    const modernMatch = await sb
      .from("games")
      .select("id")
      .eq("home", parsed.home)
      .eq("away", parsed.away)
      .in("kickoff_iso", kickoffCandidates);

    if (modernMatch.error) throw new Error(modernMatch.error.message);

    for (const row of modernMatch.data || []) {
      ids.add((row as any).id);
    }

    return [...ids];
  }

  const isoCandidates = buildLegacyIsoCandidates(parsed.kickoffISO);
  const sourceKeyCandidates = isoCandidates.map((iso) => `${iso}|${parsed.home}|${parsed.away}`);

  const [legacy, structured] = await Promise.all([
    sb
      .from("games")
      .select("id")
      .in("source_key", sourceKeyCandidates),
    sb
      .from("games")
      .select("id")
      .eq("home", parsed.home)
      .eq("away", parsed.away)
      .in("kickoff_iso", isoCandidates),
  ]);

  if (legacy.error) throw new Error(legacy.error.message);
  if (structured.error) throw new Error(structured.error.message);

  for (const row of legacy.data || []) {
    ids.add((row as any).id);
  }
  for (const row of structured.data || []) {
    ids.add((row as any).id);
  }

  return [...ids];
}

export async function findExistingGameId(
  sourceKey: string,
  kickoffISO: string,
  home: string,
  away: string
) {
  const sb = getSupabaseAdmin();
  const exact = await sb
    .from("games")
    .select("id")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (exact.error) throw new Error(exact.error.message);
  if (exact.data?.id) return exact.data.id as string;

  const homeClean = cleanInput(home);
  const awayClean = cleanInput(away);

  const exactFields = await sb
    .from("games")
    .select("id")
    .eq("home", homeClean)
    .eq("away", awayClean)
    .eq("kickoff_iso", kickoffISO)
    .maybeSingle();

  if (exactFields.error) throw new Error(exactFields.error.message);
  if (exactFields.data?.id) return exactFields.data.id as string;

  const isoCandidates = new Set<string>(buildLegacyIsoCandidates(kickoffISO));
  const parsed = parseSourceKey(sourceKey);
  if (parsed?.kind === "modern") {
    for (const iso of buildSydneyKickoffIsoCandidates(parsed.date, parsed.time)) {
      isoCandidates.add(iso);
    }
  }

  const allIsoCandidates = [...isoCandidates];
  const sourceKeyCandidates = allIsoCandidates.map((iso) => `${iso}|${homeClean}|${awayClean}`);

  const legacy = await sb
    .from("games")
    .select("id")
    .in("source_key", sourceKeyCandidates)
    .limit(1)
    .maybeSingle();

  if (legacy.error) throw new Error(legacy.error.message);
  if (legacy.data?.id) return legacy.data.id as string;

  const structured = await sb
    .from("games")
    .select("id")
    .eq("home", homeClean)
    .eq("away", awayClean)
    .in("kickoff_iso", allIsoCandidates)
    .limit(1)
    .maybeSingle();

  if (structured.error) throw new Error(structured.error.message);
  if (structured.data?.id) return structured.data.id as string;

  return null;
}
