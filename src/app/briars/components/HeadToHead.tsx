"use client";

import ui from "../briars.module.css";
import styles from "../h2h.module.css";
import { parseScore } from "../../../lib/briars/format";
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

  return {
    played,
    wins,
    draws,
    losses,
    gf,
    ga,
    gd: gf - ga,
    points: wins * 3 + draws,
  };
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
  return {
    a: (a / total) * 100,
    b: (b / total) * 100,
  };
}

function lastMeetings(allGames: Game[], teamA: string, teamB: string) {
  return allGames
    .filter(
      (g) =>
        ((g.home === teamA && g.away === teamB) ||
          (g.home === teamB && g.away === teamA)) &&
        !!parseScore(g.score)
    )
    .sort(
      (a, b) =>
        new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime()
    )
    .slice(0, 4);
}

function QuickMetric({
  label,
  a,
  b,
}: {
  label: string;
  a: number;
  b: number;
}) {
  const pct = clampPct(Math.max(a, 0), Math.max(b, 0));

  return (
    <div className={styles.metricRow}>
      <div className={styles.metricTrack}>
        <div className={styles.metricFillA} style={{ width: `${pct.a}%` }} />
        <div className={styles.metricFillB} style={{ width: `${pct.b}%` }} />
      </div>

      <div className={styles.metricInner}>
        <span className={styles.metricValue}>{a}</span>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricValueRight}>{b}</span>
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

  const seasonA = calcTeamSeasonStats(allGames, teamA);
  const seasonB = calcTeamSeasonStats(allGames, teamB);

  const h2h = calcHeadToHead(allGames, teamA, teamB);
  const recent = lastMeetings(allGames, teamA, teamB);

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Head to head</h2>

      <div className={styles.h2hCard}>
        <div className={styles.h2hHeader}>
          <span className={styles.h2hTeam}>{teamA}</span>
          <span className={styles.h2hVs}>VS</span>
          <span className={styles.h2hTeamRight}>{teamB}</span>
        </div>

        <div className={styles.quickRows}>
          <QuickMetric label="W" a={seasonA.wins} b={seasonB.wins} />
          <QuickMetric label="GF" a={seasonA.gf} b={seasonB.gf} />
          <QuickMetric label="GA" a={seasonA.ga} b={seasonB.ga} />
          <QuickMetric label="Pts" a={seasonA.points} b={seasonB.points} />
        </div>

        <div className={styles.h2hMetaStrip}>
          <span className={styles.h2hMetaPill}>Meetings {h2h.played}</span>
          <span className={styles.h2hMetaPill}>{teamA} {h2h.aWins}W</span>
          <span className={styles.h2hMetaPill}>{teamB} {h2h.bWins}W</span>
          <span className={styles.h2hMetaPill}>Draws {h2h.draws}</span>
        </div>

        <details className={styles.historyDetails}>
          <summary className={styles.historySummary}>Last meetings</summary>
          <div className={styles.historyBody}>
            {recent.length ? (
              <div className={styles.h2hLastList}>
                {recent.map((g) => (
                  <div key={`${g.kickoffISO}-${g.home}-${g.away}`} className={styles.h2hLastRow}>
                    <div className={styles.h2hLastTeams}>
                      <span className={styles.h2hLastTeam}>{g.home}</span>
                      <span className={styles.h2hLastScore}>{g.score}</span>
                      <span className={styles.h2hLastTeam}>{g.away}</span>
                    </div>
                    <div className={styles.h2hLastMeta}>
                      {g.date} • {g.time}
                    </div>
                  </div>
                ))}
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
