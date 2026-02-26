import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function auDateFromISO(iso: string) {
  // convert kickoff_at ISO → dd/mm/yyyy in Australia/Sydney
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return `${m.day}/${m.month}/${m.year}`;
}

function auTimeFromISO(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);

  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return `${m.hour}:${m.minute}:${m.second}`;
}

export async function GET() {
  const sb = supabaseAdmin();

  const { data: teams } = await sb.from("teams").select("team_key,name_full,short_name");
  const teamNameByKey = new Map((teams ?? []).map((t) => [t.team_key, t.name_full]));

  const { data: matches, error: matchErr } = await sb
    .from("matches")
    .select("round_label,kickoff_at,venue,home_team_key,away_team_key,home_score,away_score,source_hash")
    .eq("season", 2026)
    .order("kickoff_at", { ascending: true });

  if (matchErr) return NextResponse.json({ ok: false, error: matchErr.message }, { status: 500 });

  const allGames = (matches ?? []).map((m) => {
    const home = teamNameByKey.get(m.home_team_key) ?? m.home_team_key;
    const away = teamNameByKey.get(m.away_team_key) ?? m.away_team_key;

    const score =
      m.home_score === null || m.away_score === null ? "-" : `${m.home_score}-${m.away_score}`;

    return {
      date: auDateFromISO(m.kickoff_at),
      time: auTimeFromISO(m.kickoff_at),
      venue: m.venue ?? "",
      roundLabel: m.round_label ?? "",
      home,
      away,
      score,
      kickoffISO: m.kickoff_at,
    };
  });

  // “Briars fixtures” subset for the page (keeps your current behaviour)
  const briarsGames = allGames.filter((g) => g.home.toLowerCase().includes("briars") || g.away.toLowerCase().includes("briars"));

  // ladder in your existing format (headers + rows)
  const { data: ladderRows, error: ladderErr } = await sb
    .from("ladder_latest")
    .select("team_key,position,played,wins,draws,losses,gf,ga,gd,points,as_of")
    .eq("season", 2026)
    .order("position", { ascending: true });

  if (ladderErr) return NextResponse.json({ ok: false, error: ladderErr.message }, { status: 500 });

  const ladder = {
    headers: ["Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"],
    rows: (ladderRows ?? []).map((r) => {
      const team = teamNameByKey.get(r.team_key) ?? r.team_key;
      return {
        team,
        cols: [
          team,
          String(r.played ?? 0),
          String(r.wins ?? 0),
          String(r.draws ?? 0),
          String(r.losses ?? 0),
          String(r.gf ?? 0),
          String(r.ga ?? 0),
          String(r.gd ?? 0),
          String(r.points ?? 0),
        ],
      };
    }),
  };

  return NextResponse.json({
    ok: true,
    team: "Briars",
    source: "supabase",
    refreshedAt: new Date().toISOString(),
    games: briarsGames,
    allGames,
    ladder,
  });
}
