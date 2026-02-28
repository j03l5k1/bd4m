import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export function cleanInput(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseSourceKey(sourceKey: string) {
  const parts = sourceKey.split("|");
  if (parts.length < 3) return null;

  const kickoffISO = parts[0];
  const home = cleanInput(parts[1] || "");
  const away = cleanInput(parts.slice(2).join("|") || "");

  return { kickoffISO, home, away };
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

  const isoCandidates = buildLegacyIsoCandidates(parsed.kickoffISO);
  const sourceKeyCandidates = isoCandidates.map((iso) => `${iso}|${parsed.home}|${parsed.away}`);

  const legacy = await sb
    .from("games")
    .select("id")
    .in("source_key", sourceKeyCandidates);

  if (legacy.error) throw new Error(legacy.error.message);

  for (const row of legacy.data || []) {
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

  const isoCandidates = buildLegacyIsoCandidates(kickoffISO);
  const sourceKeyCandidates = isoCandidates.map(
    (iso) => `${iso}|${cleanInput(home)}|${cleanInput(away)}`
  );

  const legacy = await sb
    .from("games")
    .select("id")
    .in("source_key", sourceKeyCandidates)
    .limit(1)
    .maybeSingle();

  if (legacy.error) throw new Error(legacy.error.message);
  if (legacy.data?.id) return legacy.data.id as string;

  return null;
}
