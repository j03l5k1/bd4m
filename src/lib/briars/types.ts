export type Game = {
  date: string;
  time: string;
  venue: string;
  roundLabel: string;
  home: string;
  away: string;
  score: string;
  kickoffISO: string;
  source_key: string;
};

export type LadderRow = {
  team: string;
  cols: string[];
};

export type LadderData = {
  headers: string[];
  rows: LadderRow[];
};

export type Counts = {
  yes: number;
  maybe: number;
  no: number;
};

export type NamesByStatus = {
  yes: string[];
  maybe: string[];
  no: string[];
};

export type BriarsFixturesResponse = {
  ok: boolean;
  team: string;
  source: string;
  refreshedAt: string;
  games: Game[];
  allGames: Game[];
  ladder: LadderData;
  error?: string;
};
