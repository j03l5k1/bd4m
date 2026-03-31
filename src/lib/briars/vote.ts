export const MOTM_OPEN_AFTER_MINUTES = 65;
export const MOTM_CLOSE_AFTER_MINUTES = 120;

export type VoteStatus =
  | "no_active_vote"
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

export type VoteState = {
  status: VoteStatus;
  nowISO: string;
  game: VoteGameSummary | null;
  playerName?: string;
  nominees?: VoteNominee[];
  results?: VoteResults;
  myVotePlayerId?: string | null;
  message?: string;
};

export type VoteStateResponse = {
  ok: boolean;
  vote: VoteState;
};
