"use client";

import ui from "../briars.module.css";
import styles from "../h2h.module.css";
import { parseScore } from "../../../lib/briars/format";
import { getTeamMeta } from "../../../lib/briars/teamMeta";
import type { Game } from "../../../lib/briars/types";

type TeamSeasonStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

type H2HStats = {
  played: number;
  aWins: number;
  bWins: number;
  draws: number;
  aGF: number;
  bGF: number;
};

function calcTeamSeasonStats(allGames: Game[], teamName: string): TeamSeasonStats {
  let played = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;

  for (const game of allGames) {
    const score = parseScore(game.score);
    if (!score) continue;

    const isHome = game.home === teamName;
    const isAway = game.away === teamName;
    if (!isHome && !isAway) continue;

    played += 1;

    const teamGoals = isHome ? score.a : score.b;
    const oppGoals = isHome ? score.b : score.a;

    gf += teamGoals;
    ga += oppGoals;

    if (teamGoals > oppGoals) wins += 1;
    else if (teamGoals < oppGoals) losses += 1;
    else draws += 1;
  }

  return { played, wins, draws, losses, gf, ga, gd: gf - ga, points: wins * 3 + draws };
}

function calcHeadToHead(allGames: Game[], teamA: string, teamB: string): H2HStats {
  let played = 0;
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let aGF = 0;
  let bGF = 0;

  for (const game of allGames) {
    const isMatchup =
      (game.home === teamA && game.away === teamB) ||
      (game.home === teamB && game.away === teamA);
    if (!isMatchup) continue;

    const score = parseScore(game.score);
    if (!score) continue;

    played += 1;
    const goalsA = game.home === teamA ? score.a : score.b;
    const goalsB = game.home === teamB ? score.a : score.b;
    aGF += goalsA;
    bGF += goalsB;

    if (goalsA > goalsB) aWins += 1;
    else if (goalsB > goalsA) bWins += 1;
    else draws += 1;
  }

  return { played, aWins, bWins, draws, aGF, bGF };
}

function clampPct(a: number, b: number) {
  const total = a + b;
  if (total <= 0) return { a: 50, b: 50 };
  return { a: (a / total) * 100, b: (b / total) * 100 };
}

function lastMeetings(allGames: Game[], teamA: string, teamB: string) {
  return allGames
    .filter(
      (g) =>
        ((g.home === teamA && g.away === teamB) ||
          (g.home === teamB && g.away === teamA)) &&
        !!parseScore(g.score)
    )
    .sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime())
    .slice(0, 4);
}

function StatBar({ label, a, b }: { label: string; a: number; b: number }) {
  const pct = clampPct(Math.max(a, 0), Math.max(b, 0));
  return (
    <div className={styles.statBar}>
      <div className={styles.statTrack}>
        <div className={styles.statFillA} style={{ width: `${pct.a}%` }} />
        <div className={styles.statFillB} style={{ width: `${pct.b}%` }} />
      </div>
      <div className={styles.statInner}>
        <span className={styles.statValA}>{a}</span>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValB}>{b}</span>
      </div>
    </div>
  );
}

export default function HeadToHead({
  activeGame,
  allGames,
}: {
  activeGame: Game;
  allGames: Game[];
}) {
  const teamA = activeGame.home;
  const teamB = activeGame.away;
  const metaA = getTeamMeta(teamA);
  const metaB = getTeamMeta(teamB);

  const seasonA = calcTeamSeasonStats(allGames, teamA);
  const seasonB = calcTeamSeasonStats(allGames, teamB);
  const h2h = calcHeadToHead(allGames, teamA, teamB);
  const recent = lastMeetings(allGames, teamA, teamB);

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Head to head</h2>

      <div className={styles.h2hCard}>
        <div className={styles.h2hHeader}>
          <div className={styles.h2hTeamBlock}>
            <span className={styles.h2hTeamName}>{metaA.shortName}</span>
            <span className={styles.h2hTeamSub}>{seasonA.played}P · {seasonA.points}Pts</span>
          </div>

          <div className={styles.h2hCentre}>
            <span className={styles.h2hCentreLabel}>H2H</span>
            <div className={styles.h2hRecordRow}>
              <span className={styles.h2hRecA}>{h2h.aWins}</span>
              <span className={styles.h2hRecSep}>–</span>
              <span className={styles.h2hRecD}>{h2h.draws}</span>
              <span className={styles.h2hRecSep}>–</span>
              <span className={styles.h2hRecB}>{h2h.bWins}</span>
            </div>
          </div>

          <div className={`${styles.h2hTeamBlock} ${styles.h2hTeamBlockRight}`}>
            <span className={`${styles.h2hTeamName} ${styles.h2hTeamNameB}`}>{metaB.shortName}</span>
            <span className={styles.h2hTeamSub}>{seasonB.played}P · {seasonB.points}Pts</span>
          </div>
        </div>

        <div className={styles.statRows}>
          <StatBar label="Wins" a={seasonA.wins} b={seasonB.wins} />
          <StatBar label="Goals" a={seasonA.gf} b={seasonB.gf} />
          <StatBar label="Points" a={seasonA.points} b={seasonB.points} />
        </div>

        <details className={styles.historyDetails}>
          <summary className={styles.historySummary}>Last meetings</summary>
          <div className={styles.historyBody}>
            {recent.length ? (
              <div className={styles.h2hLastList}>
                {recent.map((g) => {
                  const score = parseScore(g.score);
                  const aIsHome = g.home === teamA;
                  const aGoals = score ? (aIsHome ? score.a : score.b) : null;
                  const bGoals = score ? (aIsHome ? score.b : score.a) : null;
                  const homeWon = aGoals !== null && bGoals !== null && aGoals > bGoals;
                  const awayWon = aGoals !== null && bGoals !== null && bGoals > aGoals;

                  return (
                    <div key={`${g.kickoffISO}-${g.home}-${g.away}`} className={styles.h2hLastRow}>
                      <div className={styles.h2hLastTeams}>
                        <span className={`${styles.h2hLastTeam} ${homeWon ? styles.h2hLastWinner : ""}`}>
                          {getTeamMeta(g.home).shortName}
                        </span>
                        <span className={styles.h2hLastScore}>{g.score}</span>
                        <span className={`${styles.h2hLastTeam} ${styles.h2hLastTeamRight} ${awayWon ? styles.h2hLastWinner : ""}`}>
                          {getTeamMeta(g.away).shortName}
                        </span>
                      </div>
                      <div className={styles.h2hLastMeta}>
                        {g.roundLabel ? `${g.roundLabel} · ` : ""}{g.date}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.h2hEmpty}>No completed meetings yet.</div>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
