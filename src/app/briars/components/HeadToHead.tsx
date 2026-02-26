"use client";

import styles from "../briars.module.css";
import type { Game } from "../page";

type TeamStats = {
  team?: string;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  gf?: number;
  ga?: number;
  gd?: number;
  points?: number;
};

function n(v: any): number {
  if (v === 0) return 0;
  if (v === null || v === undefined) return 0;
  const num = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(num) ? num : 0;
}

function parseScore(score: string): { a: number; b: number } | null {
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

function pct(numer: number, denom: number) {
  if (!denom) return 0;
  return Math.round((numer / denom) * 100);
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
  // IMPORTANT: We’re not trying to ladder-match here.
  // This is strictly “previous meetings” and only works when g.score exists AND teams match exactly.
  // If your scraped fixture labels vary, you can pass in already-normalised team names from the parent.
  const relevant = (allGames as any[]).filter(
    (g) =>
      (g.home === teamA && g.away === teamB) || (g.home === teamB && g.away === teamA)
  );

  const out: H2H = {
    played: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aGF: 0,
    aGA: 0,
    bGF: 0,
    bGA: 0,
  };

  for (const g of relevant) {
    const s = parseScore(g.score);
    if (!s) continue;

    const aHome = g.home === teamA && g.away === teamB;

    const scoreA = aHome ? s.a : s.b;
    const scoreB = aHome ? s.b : s.a;

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

export default function HeadToHead({
  teamA,
  teamB,
  teamAStats,
  teamBStats,
  allGames,
}: {
  teamA: string;
  teamB: string;
  teamAStats?: TeamStats | null;
  teamBStats?: TeamStats | null;
  allGames: Game[];
}) {
  const hasStats = !!teamAStats && !!teamBStats;

  const aPlayed = n(teamAStats?.played);
  const bPlayed = n(teamBStats?.played);
  const aW = n(teamAStats?.wins);
  const bW = n(teamBStats?.wins);
  const aD = n(teamAStats?.draws);
  const bD = n(teamBStats?.draws);
  const aL = n(teamAStats?.losses);
  const bL = n(teamBStats?.losses);
  const aGF = n(teamAStats?.gf);
  const bGF = n(teamBStats?.gf);
  const aGA = n(teamAStats?.ga);
  const bGA = n(teamBStats?.ga);
  const aGD = teamAStats?.gd !== undefined ? n(teamAStats?.gd) : aGF - aGA;
  const bGD = teamBStats?.gd !== undefined ? n(teamBStats?.gd) : bGF - bGA;
  const aPts = n(teamAStats?.points);
  const bPts = n(teamBStats?.points);

  const h2h = computeH2H(allGames, teamA, teamB);
  const aWinPct = pct(h2h.aWins, h2h.played);
  const bWinPct = pct(h2h.bWins, h2h.played);

  return (
    <details className={styles.details} open>
      <summary className={styles.summary}>
        <span>Head-to-head</span>
        <span className={styles.summaryRight}>
          {hasStats ? "Season comparison" : "Stats pending"}
        </span>
      </summary>

      <div className={styles.detailsBody}>
        <div className={styles.h2hGrid}>
          {/* Season comparison (JUST RENDERS WHAT YOU PASS IN) */}
          <div className={styles.h2hCard}>
            <div className={styles.h2hLabel}>Season comparison</div>

            {!hasStats ? (
              <div className={styles.h2hEmpty}>
                Stats not available for one or both teams.
              </div>
            ) : (
              <>
                <div className={styles.h2hEdgeRow}>
                  <div className={styles.h2hTeamName}>{teamA}</div>
                  <div className={styles.h2hMid}>vs</div>
                  <div className={styles.h2hTeamName}>{teamB}</div>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Played</span>
                  <span className={styles.h2hStatNums}>
                    {aPlayed} : {bPlayed}
                  </span>
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

          {/* Previous meetings (optional, only if scores exist AND team labels match exactly) */}
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
