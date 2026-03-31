export const GAME_DURATION_MINUTES = 60;
export const MOTM_OPEN_AFTER_GAME_END_MINUTES = 5;
export const MOTM_CLOSE_AFTER_GAME_END_MINUTES = 60;
export const MOTM_OPEN_AFTER_MINUTES =
  GAME_DURATION_MINUTES + MOTM_OPEN_AFTER_GAME_END_MINUTES;
export const MOTM_CLOSE_AFTER_MINUTES =
  GAME_DURATION_MINUTES + MOTM_CLOSE_AFTER_GAME_END_MINUTES;

export type VoteStatus =
  | "no_active_vote"
  | "vote_locked"
  | "login_required"
  | "not_eligible"
  | "eligible_to_vote"
  | "already_voted"
  | "window_closed";

export type VoteGameSummary = {
  sourceKey: string;
  roundLabel: string;
  home: string;
  away: string;
  venue: string;
  date: string;
  time: string;
  kickoffISO: string;
  voteOpensAtISO: string;
  voteClosesAtISO: string;
};

export type VoteNominee = {
  playerId: string;
  name: string;
};

export type VoteResultsEntry = {
  playerId: string;
  name: string;
  votes: number;
  percentage: number;
};

export type VoteResults = {
  totalVotes: number;
  entries: VoteResultsEntry[];
};

export type VoteSeasonStatsEntry = {
  playerId: string;
  name: string;
  manOfTheMatchCount: number;
  points: number;
  totalVotes: number;
};

export type VoteSeasonStats = {
  gamesWithVotes: number;
  entries: VoteSeasonStatsEntry[];
};

export type VoteState = {
  status: VoteStatus;
  nowISO: string;
  game: VoteGameSummary | null;
  playerName?: string;
  nominees?: VoteNominee[];
  results?: VoteResults;
  seasonStats?: VoteSeasonStats;
  myVotePlayerId?: string | null;
  message?: string;
};

export type VoteStateResponse = {
  ok: boolean;
  vote: VoteState;
};
