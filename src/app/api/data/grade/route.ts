import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { CURRENT_SEASON } from "@/lib/briars/constants";

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();

  const { data: ladder, error: ladderErr } = await sb
    .from("ladder_latest")
    .select("season,team_key,position,played,wins,draws,losses,gf,ga,gd,points,as_of")
    .eq("season", CURRENT_SEASON)
    .order("position", { ascending: true });

  if (ladderErr) return NextResponse.json({ ok: false, error: ladderErr.message }, { status: 500 });

  const { data: matches, error: matchErr } = await sb
    .from("matches")
    .select("season,round_label,kickoff_at,venue,home_team_key,away_team_key,home_score,away_score,source_hash,updated_at")
    .eq("season", CURRENT_SEASON)
    .order("kickoff_at", { ascending: true });

  if (matchErr) return NextResponse.json({ ok: false, error: matchErr.message }, { status: 500 });

  // team name map for UI display
  const { data: teams, error: teamErr } = await sb.from("teams").select("team_key,name_full,short_name");
  if (teamErr) return NextResponse.json({ ok: false, error: teamErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    season: CURRENT_SEASON,
    ladder,
    matches,
    teams,
  });
}
