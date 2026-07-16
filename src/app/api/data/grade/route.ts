import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { CURRENT_SEASON } from "@/lib/briars/constants";

export const runtime = "nodejs";

export async function GET() {
  const sql = getSql();

  const ladder = await sql`
    select season, team_key, position, played, wins, draws, losses, gf, ga, gd, points, as_of
    from ladder_latest
    where season = ${CURRENT_SEASON}
    order by position asc`;

  const matches = await sql`
    select season, round_label, kickoff_at, venue, home_team_key, away_team_key,
           home_score, away_score, source_hash, updated_at
    from matches
    where season = ${CURRENT_SEASON}
    order by kickoff_at asc`;

  // team name map for UI display
  const teams = await sql`select team_key, name_full, short_name from teams`;

  return NextResponse.json({
    ok: true,
    season: CURRENT_SEASON,
    ladder,
    matches,
    teams,
  });
}
