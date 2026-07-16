import { getSql } from "@/lib/db";

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
  const sql = getSql();
  const exact = await sql`select id from games where source_key = ${sourceKey}`;

  const ids = new Set<string>(exact.map((row: any) => row.id));

  const parsed = parseSourceKey(sourceKey);
  if (!parsed) return [...ids];

  if (parsed.kind === "modern") {
    const kickoffCandidates = buildSydneyKickoffIsoCandidates(parsed.date, parsed.time);
    if (!kickoffCandidates.length) return [...ids];

    const modernMatch = await sql`
      select id from games
      where home = ${parsed.home} and away = ${parsed.away}
        and kickoff_iso = ANY(${kickoffCandidates})`;

    for (const row of modernMatch) {
      ids.add((row as any).id);
    }

    return [...ids];
  }

  const isoCandidates = buildLegacyIsoCandidates(parsed.kickoffISO);
  const sourceKeyCandidates = isoCandidates.map((iso) => `${iso}|${parsed.home}|${parsed.away}`);

  const [legacy, structured] = await Promise.all([
    sql`select id from games where source_key = ANY(${sourceKeyCandidates})`,
    sql`
      select id from games
      where home = ${parsed.home} and away = ${parsed.away}
        and kickoff_iso = ANY(${isoCandidates})`,
  ]);

  for (const row of legacy) {
    ids.add((row as any).id);
  }
  for (const row of structured) {
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
  const sql = getSql();
  const exact = await sql`select id from games where source_key = ${sourceKey} limit 1`;
  if (exact[0]?.id) return exact[0].id as string;

  const homeClean = cleanInput(home);
  const awayClean = cleanInput(away);

  const exactFields = await sql`
    select id from games
    where home = ${homeClean} and away = ${awayClean} and kickoff_iso = ${kickoffISO}
    limit 1`;
  if (exactFields[0]?.id) return exactFields[0].id as string;

  const isoCandidates = new Set<string>(buildLegacyIsoCandidates(kickoffISO));
  const parsed = parseSourceKey(sourceKey);
  if (parsed?.kind === "modern") {
    for (const iso of buildSydneyKickoffIsoCandidates(parsed.date, parsed.time)) {
      isoCandidates.add(iso);
    }
  }

  const allIsoCandidates = [...isoCandidates];
  const sourceKeyCandidates = allIsoCandidates.map((iso) => `${iso}|${homeClean}|${awayClean}`);

  const legacy = await sql`
    select id from games where source_key = ANY(${sourceKeyCandidates}) limit 1`;
  if (legacy[0]?.id) return legacy[0].id as string;

  const structured = await sql`
    select id from games
    where home = ${homeClean} and away = ${awayClean}
      and kickoff_iso = ANY(${allIsoCandidates})
    limit 1`;
  if (structured[0]?.id) return structured[0].id as string;

  return null;
}
