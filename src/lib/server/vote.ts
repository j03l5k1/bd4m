import { CURRENT_SEASON, TEAM_MATCH_TEXT } from "@/lib/briars/constants";
import {
  MOTM_CLOSE_AFTER_MINUTES,
  MOTM_OPEN_AFTER_MINUTES,
  type VoteGameSummary,
  type VoteNominee,
  type VoteResults,
  type VoteResultsEntry,
  type VoteSeasonStats,
  type VoteSeasonStatsEntry,
} from "@/lib/briars/vote";
import { buildSourceKey, normaliseName } from "@/lib/briars/format";
import { getSql } from "@/lib/db";
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

export function getVoteWindowState(
  game: VoteGameSummary,
  now = new Date()
): "locked" | "open" | "closed" {
  const nowMs = now.getTime();
  const opensAt = new Date(game.voteOpensAtISO).getTime();
  const closesAt = new Date(game.voteClosesAtISO).getTime();

  if (nowMs < opensAt) return "locked";
  if (nowMs <= closesAt) return "open";
  return "closed";
}

/** Returns the Unix ms timestamp for 6am Sydney time on the same calendar day as the given ISO string. */
function sydney6amMs(isoString: string): number {
  const d = new Date(isoString);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  // Determine Sydney UTC offset: AEDT (Oct–Mar) = +11, AEST (Apr–Sep) = +10
  const month = parseInt(parts.month, 10);
  const offset = month >= 10 || month <= 3 ? 11 : 10;
  const offsetStr = `+${String(offset).padStart(2, "0")}:00`;
  return new Date(`${parts.year}-${parts.month}-${parts.day}T06:00:00${offsetStr}`).getTime();
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
  const sql = getSql();

  const teams = await sql`select team_key, name_full from teams`;

  const teamNameByKey = new Map((teams ?? []).map((team: any) => [team.team_key, team.name_full]));

  const matches = await sql`
    select round_label, kickoff_at, venue, home_team_key, away_team_key
    from matches
    where season = ${CURRENT_SEASON}
    order by kickoff_at asc`;

  const briarsGames = (matches ?? [])
    .map((match) => mapMatchToVoteGame(match as RawMatch, teamNameByKey))
    .filter(
      (game) =>
        game.home.toLowerCase().includes(TEAM_MATCH_TEXT) ||
        game.away.toLowerCase().includes(TEAM_MATCH_TEXT)
    )
    .sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());

  // Assign sequential "Rd N" when round_label is missing in the DB
  let rdCounter = 0;
  for (const game of briarsGames) {
    rdCounter++;
    if (!game.roundLabel) game.roundLabel = `Rd ${rdCounter}`;
  }

  return briarsGames;
}

export async function findActiveVoteGame(now = new Date()) {
  const game = await findVotePageGame(now);
  if (!game) return null;
  return getVoteWindowState(game, now) === "open" ? game : null;
}

export async function findVotePageGame(now = new Date()) {
  const nowMs = now.getTime();
  const games = await loadBriarsVoteGames();

  const sorted = [...games].sort(
    (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
  );

  // First priority: a game whose vote window is still open or upcoming
  const activeGame = sorted.find(
    (game) => new Date(game.voteClosesAtISO).getTime() >= nowMs
  );
  if (activeGame) return activeGame;

  // Second priority: the most recently closed game, shown until 6am Sydney
  // on the morning of the next scheduled match (then it flips to that match).
  const closedGames = sorted
    .filter((game) => new Date(game.voteClosesAtISO).getTime() < nowMs)
    .reverse(); // most-recent first

  const lastGame = closedGames[0];
  if (!lastGame) return null;

  const nextGame = sorted.find(
    (game) => new Date(game.kickoffISO).getTime() > new Date(lastGame.kickoffISO).getTime()
  );

  const showUntilMs = nextGame
    ? sydney6amMs(nextGame.kickoffISO)
    : new Date(lastGame.voteClosesAtISO).getTime() + 7 * 24 * 60 * 60 * 1000;

  return nowMs < showUntilMs ? lastGame : null;
}

export async function ensureVoteGameId(game: VoteGameSummary) {
  const sql = getSql();

  let gameId = await findExistingGameId(game.sourceKey, game.kickoffISO, game.home, game.away);
  if (gameId) return gameId;

  const rows = await sql`
    insert into games (source_key, kickoff_iso, home, away, venue)
    values (${game.sourceKey}, ${game.kickoffISO}, ${game.home}, ${game.away}, ${game.venue || null})
    returning id`;

  if (!rows[0]?.id) {
    throw new Error("Could not create vote game record");
  }

  gameId = rows[0].id as string;
  return gameId;
}

export async function getEligibleVotePlayers(game: VoteGameSummary): Promise<VoteNominee[]> {
  const sql = getSql();
  const gameIds = await findMatchingGameIds(game.sourceKey);

  if (!gameIds.length) return [];

  const rows = await sql`
    select a.player_id, p.name
    from availability a
    join players p on p.id = a.player_id
    where a.status = 'yes' and a.game_id = ANY(${gameIds})`;

  const byId = new Map<string, VoteNominee>();
  for (const row of rows || []) {
    const playerId = String((row as any).player_id || "").trim();
    const name = cleanInput((row as any)?.name || "");
    if (!playerId || !name || byId.has(playerId)) continue;
    byId.set(playerId, { playerId, name });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function findPlayerByName(playerName: string) {
  const cleaned = cleanInput(playerName);
  if (cleaned.length < 2) return null;

  const sql = getSql();
  const rows = await sql`select id, name from players where name = ${cleaned} limit 1`;
  const data = rows[0];
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
  const sql = getSql();
  const rows = await sql`
    select nominee_player_id from motm_votes
    where game_id = ${gameId} and voter_player_id = ${voterPlayerId}
    limit 1`;
  return String(rows[0]?.nominee_player_id || "").trim() || null;
}

export async function getVoteResults(gameId: string): Promise<VoteResults> {
  const sql = getSql();
  const rows = await sql`
    select nominee_player_id from motm_votes where game_id = ${gameId}`;

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

  const players = await sql`select id, name from players where id = ANY(${nomineeIds})`;

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

export async function getSeasonVoteStats(): Promise<VoteSeasonStats> {
  const sql = getSql();
  const seasonGames = await loadBriarsVoteGames();

  const gamePairs = await Promise.all(
    seasonGames.map(async (game) => ({
      gameId: await findExistingGameId(game.sourceKey, game.kickoffISO, game.home, game.away),
      game,
    }))
  );

  const trackedGameIds = gamePairs
    .map((pair) => pair.gameId)
    .filter((gameId): gameId is string => Boolean(gameId));

  if (!trackedGameIds.length) {
    return { gamesWithVotes: 0, entries: [] };
  }

  const [voteRows, playerRows] = await Promise.all([
    sql`
      select game_id, nominee_player_id from motm_votes
      where game_id = ANY(${trackedGameIds})`,
    sql`
      select a.player_id, p.name
      from availability a
      join players p on p.id = a.player_id
      where a.status = 'yes' and a.game_id = ANY(${trackedGameIds})`,
  ]);

  const playerNameById = new Map<string, string>();
  for (const row of playerRows || []) {
    const playerId = String((row as any).player_id || "").trim();
    const name = cleanInput((row as any)?.name || "");
    if (!playerId || !name || playerNameById.has(playerId)) continue;
    playerNameById.set(playerId, name);
  }

  const voteCountsByGame = new Map<string, Map<string, number>>();
  for (const row of voteRows || []) {
    const gameId = String((row as any).game_id || "").trim();
    const nomineeId = String((row as any).nominee_player_id || "").trim();
    if (!gameId || !nomineeId) continue;

    if (!voteCountsByGame.has(gameId)) {
      voteCountsByGame.set(gameId, new Map<string, number>());
    }
    const gameCounts = voteCountsByGame.get(gameId)!;
    gameCounts.set(nomineeId, (gameCounts.get(nomineeId) || 0) + 1);
  }

  for (const gameCounts of voteCountsByGame.values()) {
    for (const playerId of gameCounts.keys()) {
      if (!playerNameById.has(playerId)) {
        playerNameById.set(playerId, "Unknown player");
      }
    }
  }

  const statsByPlayer = new Map<string, VoteSeasonStatsEntry>();
  for (const [playerId, name] of playerNameById.entries()) {
    statsByPlayer.set(playerId, {
      playerId,
      name,
      manOfTheMatchCount: 0,
      points: 0,
      totalVotes: 0,
    });
  }

  const rankPoints = [3, 2, 1];

  for (const gameCounts of voteCountsByGame.values()) {
    const distinctVoteTotals = [...new Set([...gameCounts.values()].sort((a, b) => b - a))];

    for (const [playerId, votes] of gameCounts.entries()) {
      const entry =
        statsByPlayer.get(playerId) ||
        ({
          playerId,
          name: playerNameById.get(playerId) || "Unknown player",
          manOfTheMatchCount: 0,
          points: 0,
          totalVotes: 0,
        } satisfies VoteSeasonStatsEntry);

      const rankIndex = distinctVoteTotals.indexOf(votes);
      if (rankIndex === 0) entry.manOfTheMatchCount += 1;
      if (rankIndex >= 0 && rankIndex < rankPoints.length) {
        entry.points += rankPoints[rankIndex];
      }
      entry.totalVotes += votes;

      statsByPlayer.set(playerId, entry);
    }
  }

  const entries = [...statsByPlayer.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.manOfTheMatchCount !== a.manOfTheMatchCount) {
      return b.manOfTheMatchCount - a.manOfTheMatchCount;
    }
    if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
    return a.name.localeCompare(b.name);
  });

  return {
    gamesWithVotes: voteCountsByGame.size,
    entries,
  };
}
