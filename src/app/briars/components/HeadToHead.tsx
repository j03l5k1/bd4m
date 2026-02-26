"use client";

import styles from "../briars.module.css";
import type { Game } from "../page";

function normTeam(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .trim();
}

function sameTeam(a: string, b: string) {
  const A = normTeam(a);
  const B = normTeam(b);

  if (!A || !B) return false;
  if (A === B) return true;

  // More forgiving matching for shortened labels like:
  // "Macquarie" vs "Macquarie Uni 2"
  if (A.startsWith(B) || B.startsWith(A)) return true;

  // Also allow first-word matching as a fallback
  const aFirst = A.split(" ")[0];
  const bFirst = B.split(" ")[0];
  if (aFirst && bFirst && aFirst === bFirst) return true;

  return false;
}

function parseScore(score: string): { a: number; b: number } | null {
  // supports: "2-1", "2–1", "2 — 1", "2 : 1" etc
  const cleaned = String(score || "")
    .replace(/[^\d\-–: ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const m = cleaned.match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { a, b };
}

type H2H = {
  played: number;
  aWins: number;
  bWins: number;
  draws: number;
  aGF: number;
  aGA: number;
  bGF: number;
  bGA: number;
};

function computeH2H(allGames: Game[], teamA: string, teamB: string): H2H {
  const relevant = allGames.filter((g: any) => {
    const homeVsAway = sameTeam(g.home, teamA) && sameTeam(g.away, teamB);
    const awayVsHome = sameTeam(g.home, teamB) && sameTeam(g.away, teamA);
    return homeVsAway || awayVsHome;
  });

  let out: H2H = {
    played: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aGF: 0,
    aGA: 0,
    bGF: 0,
    bGA: 0,
  };

  for (const g of relevant as any[]) {
    const s = parseScore((g as any).score);
    if (!s) continue;

    let scoreA = 0;
    let scoreB = 0;

    if (sameTeam((g as any).home, teamA) && sameTeam((g as any).away, teamB)) {
      scoreA = s.a;
      scoreB = s.b;
    } else if (
      sameTeam((g as any).home, teamB) &&
      sameTeam((g as any).away, teamA)
    ) {
      scoreA = s.b;
      scoreB = s.a;
    } else {
      continue;
    }

    out.played += 1;
    out.aGF += scoreA;
    out.aGA += scoreB;
    out.bGF += scoreB;
    out.bGA += scoreA;

    if (scoreA > scoreB) out.aWins += 1;
    else if (scoreB > scoreA) out.bWins += 1;
    else out.draws += 1;
  }

  return out;
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

/**
 * Ladder rows can vary a bit in naming depending on your scraper/source.
 * This helper tries a bunch of common keys.
 */
type LadderRow = Record<string, any>;

function getNum(row: LadderRow | undefined, keys: string[], fallback = 0) {
  if (!row) return fallback;
  for (const k of keys) {
    const v = row[k];
    if (v === 0) return 0;
    if (v === null || v === undefined) continue;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function getTeamLabel(row: LadderRow | undefined) {
  if (!row) return "";
  return (
    row.team ??
    row.Team ??
    row.name ??
    row.Name ??
    row.club ??
    row.Club ??
    ""
  );
}

function findLadderRow(ladder: LadderRow[] | undefined, team: string) {
  if (!ladder?.length) return undefined;
  return ladder.find((r) => sameTeam(getTeamLabel(r), team));
}

export default function HeadToHead({
  allGames,
  ladder,
  teamA,
  teamB,
}: {
  allGames: Game[];
  ladder?: LadderRow[];
  teamA: string;
  teamB: string;
}) {
  // --- Ladder comparison (season-to-date team stats) ---
  const aRow = findLadderRow(ladder, teamA);
  const bRow = findLadderRow(ladder, teamB);

  const aW = getNum(aRow, ["w", "W", "wins", "Wins", "won", "Won"]);
  const aD = getNum(aRow, ["d", "D", "draws", "Draws", "drawn", "Drawn"]);
  const aL = getNum(aRow, ["l", "L", "losses", "Losses", "lost", "Lost"]);
  const aGF = getNum(aRow, ["gf", "GF", "goalsFor", "Goals For", "goals_for"]);
  const aGA = getNum(
    aRow,
    ["ga", "GA", "goalsAgainst", "Goals Against", "goals_against"]
  );
  const aGD = getNum(
    aRow,
    ["gd", "GD", "diff", "Diff", "goalDiff", "Goal Diff", "goal_diff"],
    aGF - aGA
  );
  const aPts = getNum(aRow, ["pts", "PTS", "points", "Points", "P"]);

  const bW = getNum(bRow, ["w", "W", "wins", "Wins", "won", "Won"]);
  const bD = getNum(bRow, ["d", "D", "draws", "Draws", "drawn", "Drawn"]);
  const bL = getNum(bRow, ["l", "L", "losses", "Losses", "lost", "Lost"]);
  const bGF = getNum(bRow, ["gf", "GF", "goalsFor", "Goals For", "goals_for"]);
  const bGA = getNum(
    bRow,
    ["ga", "GA", "goalsAgainst", "Goals Against", "goals_against"]
  );
  const bGD = getNum(
    bRow,
    ["gd", "GD", "diff", "Diff", "goalDiff", "Goal Diff", "goal_diff"],
    bGF - bGA
  );
  const bPts = getNum(bRow, ["pts", "PTS", "points", "Points", "P"]);

  const ladderReady = !!aRow && !!bRow;

  // --- True head-to-head (previous meetings with scores) ---
  const h2h = computeH2H(allGames, teamA, teamB);

  const aWinPct = pct(h2h.aWins, h2h.played);
  const bWinPct = pct(h2h.bWins, h2h.played);

  return (
    <details className={styles.details} open>
      <summary className={styles.summary}>
        <span>Head-to-head</span>
        <span className={styles.summaryRight}>
          {h2h.played > 0
            ? `${h2h.played} meetings • ${h2h.aWins}-${h2h.draws}-${h2h.bWins}`
            : ladderReady
            ? "Season comparison"
            : "Comparison pending"}
        </span>
      </summary>

      <div className={styles.detailsBody}>
        <div className={styles.h2hGrid}>
          {/* Season comparison (LADDER-BASED) */}
          <div className={styles.h2hCard}>
            <div className={styles.h2hLabel}>Season comparison</div>

            {!ladderReady ? (
              <div className={styles.h2hEmpty}>
                Couldn’t match both teams to the ladder yet.
                <br />
                <span style={{ opacity: 0.75 }}>
                  ({teamA} vs {teamB})
                </span>
              </div>
            ) : (
              <>
                <div className={styles.h2hEdgeRow}>
                  <div className={styles.h2hTeamName}>{teamA}</div>
                  <div className={styles.h2hMid}>vs</div>
                  <div className={styles.h2hTeamName}>{teamB}</div>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Wins</span>
                  <span className={styles.h2hStatNums}>
                    {aW} : {bW}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Draws</span>
                  <span className={styles.h2hStatNums}>
                    {aD} : {bD}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Losses</span>
                  <span className={styles.h2hStatNums}>
                    {aL} : {bL}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals for</span>
                  <span className={styles.h2hStatNums}>
                    {aGF} : {bGF}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals against</span>
                  <span className={styles.h2hStatNums}>
                    {aGA} : {bGA}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goal diff</span>
                  <span className={styles.h2hStatNums}>
                    {aGD} : {bGD}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Points</span>
                  <span className={styles.h2hStatNums}>
                    {aPts} : {bPts}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Previous meetings (FIXTURE-SCORED H2H) */}
          <div className={styles.h2hCard}>
            <div className={styles.h2hLabel}>Previous meetings</div>

            {h2h.played === 0 ? (
              <div className={styles.h2hEmpty}>
                No scored matches between these two yet.
              </div>
            ) : (
              <>
                <div className={styles.h2hEdgeRow}>
                  <div className={styles.h2hTeamName}>{teamA}</div>
                  <div className={styles.h2hMid}>vs</div>
                  <div className={styles.h2hTeamName}>{teamB}</div>
                </div>

                <div className={styles.h2hBarWrap}>
                  <div className={styles.h2hBarTrack}>
                    <div
                      className={styles.h2hBarFillA}
                      style={{ width: `${aWinPct}%` }}
                    />
                    <div
                      className={styles.h2hBarFillB}
                      style={{ width: `${bWinPct}%` }}
                    />
                  </div>
                  <div className={styles.h2hBarLegend}>
                    <span>
                      {teamA}: {aWinPct}% wins
                    </span>
                    <span>
                      {teamB}: {bWinPct}% wins
                    </span>
                  </div>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Wins</span>
                  <span className={styles.h2hStatNums}>
                    {h2h.aWins} : {h2h.bWins}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals for</span>
                  <span className={styles.h2hStatNums}>
                    {h2h.aGF} : {h2h.bGF}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals against</span>
                  <span className={styles.h2hStatNums}>
                    {h2h.aGA} : {h2h.bGA}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Draws</span>
                  <span className={styles.h2hStatNums}>{h2h.draws}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
