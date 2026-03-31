import { CURRENT_SEASON, TEAM_MATCH_TEXT } from "@/lib/briars/constants";
import {
  MOTM_CLOSE_AFTER_MINUTES,
  MOTM_OPEN_AFTER_MINUTES,
  type VoteGameSummary,
  type VoteNominee,
  type VoteResults,
  type VoteResultsEntry,
} from "@/lib/briars/vote";
import { buildSourceKey, normaliseName } from "@/lib/briars/format";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanInput, findExistingGameId, findMatchingGameIds } from "@/lib/server/availability";

type RawMatch = {
  round_label: string | null;
  kickoff_at: string;
  venue: string | null;
  home_team_key: string;
  away_team_key: string;
};

function auDateFromISO(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.day}/${map.month}/${map.year}`;
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

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.hour}:${map.minute}:${map.second}`;
}

function buildVoteWindow(kickoffISO: string) {
  const kickoffMs = new Date(kickoffISO).getTime();
  return {
    voteOpensAtISO: new Date(kickoffMs + MOTM_OPEN_AFTER_MINUTES * 60_000).toISOString(),
    voteClosesAtISO: new Date(kickoffMs + MOTM_CLOSE_AFTER_MINUTES * 60_000).toISOString(),
  };
}

function mapMatchToVoteGame(match: RawMatch, teamNameByKey: Map<string, string>): VoteGameSummary {
  const home = cleanInput(teamNameByKey.get(match.home_team_key) ?? match.home_team_key);
  const away = cleanInput(teamNameByKey.get(match.away_team_key) ?? match.away_team_key);
  const venue = cleanInput(match.venue ?? "");
  const kickoffISO = match.kickoff_at;
  const date = auDateFromISO(kickoffISO);
  const time = auTimeFromISO(kickoffISO);
  const sourceKey = buildSourceKey({ date, time, home, away, venue });
  const { voteOpensAtISO, voteClosesAtISO } = buildVoteWindow(kickoffISO);

  return {
    sourceKey,
    roundLabel: cleanInput(match.round_label ?? ""),
    home,
    away,
    venue,
    date,
    time,
    kickoffISO,
    voteOpensAtISO,
    voteClosesAtISO,
  };
}

export async function loadBriarsVoteGames() {
  const sb = getSupabaseAdmin();

  const { data: teams, error: teamErr } = await sb
    .from("teams")
    .select("team_key,name_full");

  if (teamErr) throw new Error(teamErr.message);

  const teamNameByKey = new Map((teams ?? []).map((team: any) => [team.team_key, team.name_full]));

  const { data: matches, error: matchErr } = await sb
    .from("matches")
    .select("round_label,kickoff_at,venue,home_team_key,away_team_key")
    .eq("season", CURRENT_SEASON)
    .order("kickoff_at", { ascending: true });

  if (matchErr) throw new Error(matchErr.message);

  return (matches ?? [])
    .map((match) => mapMatchToVoteGame(match as RawMatch, teamNameByKey))
    .filter(
      (game) =>
        game.home.toLowerCase().includes(TEAM_MATCH_TEXT) ||
        game.away.toLowerCase().includes(TEAM_MATCH_TEXT)
    );
}

export async function findActiveVoteGame(now = new Date()) {
  const nowMs = now.getTime();
  const games = await loadBriarsVoteGames();

  return (
    games
      .filter((game) => {
        const opensAt = new Date(game.voteOpensAtISO).getTime();
        const closesAt = new Date(game.voteClosesAtISO).getTime();
        return nowMs >= opensAt && nowMs <= closesAt;
      })
      .sort(
        (a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime()
      )[0] ?? null
  );
}

export async function ensureVoteGameId(game: VoteGameSummary) {
  const sb = getSupabaseAdmin();

  let gameId = await findExistingGameId(game.sourceKey, game.kickoffISO, game.home, game.away);
  if (gameId) return gameId;

  const { data: row, error } = await sb
    .from("games")
    .insert({
      source_key: game.sourceKey,
      kickoff_iso: game.kickoffISO,
      home: game.home,
      away: game.away,
      venue: game.venue || null,
    })
    .select("id")
    .single();

  if (error || !row?.id) {
    throw new Error(error?.message || "Could not create vote game record");
  }

  gameId = row.id as string;
  return gameId;
}

export async function getEligibleVotePlayers(game: VoteGameSummary): Promise<VoteNominee[]> {
  const sb = getSupabaseAdmin();
  const gameIds = await findMatchingGameIds(game.sourceKey);

  if (!gameIds.length) return [];

  const { data: rows, error } = await sb
    .from("availability")
    .select("player_id,status,players(name)")
    .eq("status", "yes")
    .in("game_id", gameIds);

  if (error) throw new Error(error.message);

  const byId = new Map<string, VoteNominee>();
  for (const row of rows || []) {
    const playerId = String((row as any).player_id || "").trim();
    const name = cleanInput((row as any)?.players?.name || "");
    if (!playerId || !name || byId.has(playerId)) continue;
    byId.set(playerId, { playerId, name });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findPlayerByName(playerName: string) {
  const cleaned = cleanInput(playerName);
  if (cleaned.length < 2) return null;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("players")
    .select("id,name")
    .eq("name", cleaned)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return null;

  return {
    id: data.id as string,
    name: cleanInput(data.name || cleaned),
  };
}

export function isEligibleVoter(
  playerName: string,
  eligiblePlayers: VoteNominee[]
) {
  const needle = normaliseName(playerName);
  return eligiblePlayers.find((player) => normaliseName(player.name) === needle) ?? null;
}

export async function getExistingVote(gameId: string, voterPlayerId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("motm_votes")
    .select("nominee_player_id")
    .eq("game_id", gameId)
    .eq("voter_player_id", voterPlayerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return String(data?.nominee_player_id || "").trim() || null;
}

export async function getVoteResults(gameId: string): Promise<VoteResults> {
  const sb = getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from("motm_votes")
    .select("nominee_player_id")
    .eq("game_id", gameId);

  if (error) throw new Error(error.message);

  const voteCounts = new Map<string, number>();
  for (const row of rows || []) {
    const nomineeId = String((row as any).nominee_player_id || "").trim();
    if (!nomineeId) continue;
    voteCounts.set(nomineeId, (voteCounts.get(nomineeId) || 0) + 1);
  }

  const nomineeIds = [...voteCounts.keys()];
  if (!nomineeIds.length) {
    return { totalVotes: 0, entries: [] };
  }

  const { data: players, error: playerErr } = await sb
    .from("players")
    .select("id,name")
    .in("id", nomineeIds);

  if (playerErr) throw new Error(playerErr.message);

  const playerNameById = new Map(
    (players ?? []).map((player: any) => [String(player.id), cleanInput(player.name || "")])
  );

  const totalVotes = [...voteCounts.values()].reduce((sum, count) => sum + count, 0);
  const entries: VoteResultsEntry[] = nomineeIds
    .map((playerId) => ({
      playerId,
      name: playerNameById.get(playerId) || "Unknown player",
      votes: voteCounts.get(playerId) || 0,
      percentage: totalVotes ? Math.round(((voteCounts.get(playerId) || 0) / totalVotes) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.name.localeCompare(b.name);
    });

  return { totalVotes, entries };
}
