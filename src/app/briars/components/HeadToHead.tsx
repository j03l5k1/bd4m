"use client";

import type { CSSProperties } from "react";
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

function isBriarsTeam(name: string) {
  return String(name || "").toLowerCase().includes("briars");
}

function StatBar({ label, a, b }: { label: string; a: number; b: number }) {
  const cleanA = Math.max(a, 0);
  const cleanB = Math.max(b, 0);
  const pct = clampPct(cleanA, cleanB);
  const delta = Math.abs(cleanA - cleanB);
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricTop}>
        <span className={styles.metricValA}>{a}</span>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricValB}>{b}</span>
      </div>
      <div className={styles.metricTrack}>
        <div className={styles.metricRail} />
        <div className={styles.metricFillA} style={{ width: `${pct.a}%` }} />
        <div className={styles.metricFillB} style={{ width: `${pct.b}%` }} />
      </div>
      <div className={styles.metricBottom}>
        <span className={styles.metricPctA}>{Math.round(pct.a)}%</span>
        <span className={styles.metricEdge}>{delta === 0 ? "Level" : `${delta} edge`}</span>
        <span className={styles.metricPctB}>{Math.round(pct.b)}%</span>
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
  const teamAIsBriars = isBriarsTeam(teamA);
  const teamBIsBriars = isBriarsTeam(teamB);
  const hasBriars = teamAIsBriars || teamBIsBriars;

  const seasonA = calcTeamSeasonStats(allGames, teamA);
  const seasonB = calcTeamSeasonStats(allGames, teamB);
  const h2h = calcHeadToHead(allGames, teamA, teamB);
  const recent = lastMeetings(allGames, teamA, teamB);
  const hasPlayedH2H = h2h.played > 0;
  const shareA = h2h.played ? (h2h.aWins / h2h.played) * 100 : 33.34;
  const shareD = h2h.played ? (h2h.draws / h2h.played) * 100 : 33.33;
  const shareB = h2h.played ? Math.max(0, 100 - shareA - shareD) : 33.33;
  const splitPoint = shareA + shareD;
  const ringColorA = teamAIsBriars ? "#7a0028" : "#14b8a6";
  const ringColorD = hasBriars ? "#d4a328" : "#cbd5e1";
  const ringColorB = teamBIsBriars ? "#7a0028" : "#f59e0b";
  const ringStyle: CSSProperties = {
    background: `conic-gradient(
      from -90deg,
      ${ringColorA} 0% ${shareA}%,
      ${ringColorD} ${shareA}% ${splitPoint}%,
      ${ringColorB} ${splitPoint}% 100%
    )`,
  };
  const aShareLabel = h2h.played ? Math.round(shareA) : 0;
  const dShareLabel = h2h.played ? Math.round(shareD) : 0;
  const bShareLabel = h2h.played ? Math.round(shareB) : 0;
  const aShareText = hasPlayedH2H ? `${aShareLabel}%` : "n/a";
  const dShareText = hasPlayedH2H ? `${dShareLabel}%` : "n/a";
  const bShareText = hasPlayedH2H ? `${bShareLabel}%` : "n/a";
  const aGoalDiff = seasonA.gd >= 0 ? `+${seasonA.gd}` : `${seasonA.gd}`;
  const bGoalDiff = seasonB.gd >= 0 ? `+${seasonB.gd}` : `${seasonB.gd}`;
  const cardClassName = [
    styles.h2hCard,
    hasBriars ? styles.h2hBriars : "",
    teamAIsBriars ? styles.h2hBriarsA : "",
    teamBIsBriars ? styles.h2hBriarsB : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Head to head</h2>

      <div className={cardClassName}>
        <div className={styles.h2hSnapshot}>
          <div className={`${styles.teamPanel} ${styles.teamPanelA} ${teamAIsBriars ? styles.teamPanelBriars : ""}`}>
            <span className={styles.teamKicker}>Home side</span>
            <span className={`${styles.teamName} ${teamAIsBriars ? styles.teamNameBriars : ""}`}>{metaA.shortName}</span>
            <div className={styles.teamFormRow}>
              <span className={styles.teamFormChip}>{seasonA.played} played</span>
              <span className={styles.teamFormChip}>{seasonA.points} pts</span>
              <span className={styles.teamFormChip}>{aGoalDiff} GD</span>
            </div>
          </div>

          <div className={styles.ringPanel}>
            <span className={styles.ringKicker}>H2H Split</span>
            <div className={styles.ringShell}>
              <div className={styles.ringChart} style={ringStyle}>
                <div className={styles.ringCore}>
                  <span className={styles.ringValue}>{h2h.played}</span>
                  <span className={styles.ringText}>games</span>
                </div>
              </div>
            </div>
            <div className={styles.recordLegend}>
              <span className={`${styles.legendChip} ${styles.legendChipA}`}>
                {h2h.aWins}W · {aShareText}
              </span>
              <span className={`${styles.legendChip} ${styles.legendChipD}`}>
                {h2h.draws}D · {dShareText}
              </span>
              <span className={`${styles.legendChip} ${styles.legendChipB}`}>
                {h2h.bWins}W · {bShareText}
              </span>
            </div>
            {!hasPlayedH2H ? (
              <div className={styles.recordHint}>No completed H2H results yet this season.</div>
            ) : null}
          </div>

          <div className={`${styles.teamPanel} ${styles.teamPanelB} ${teamBIsBriars ? styles.teamPanelBriars : ""}`}>
            <span className={styles.teamKicker}>Away side</span>
            <span className={`${styles.teamName} ${teamBIsBriars ? styles.teamNameBriars : ""}`}>{metaB.shortName}</span>
            <div className={styles.teamFormRow}>
              <span className={styles.teamFormChip}>{seasonB.played} played</span>
              <span className={styles.teamFormChip}>{seasonB.points} pts</span>
              <span className={styles.teamFormChip}>{bGoalDiff} GD</span>
            </div>
          </div>
        </div>

        <div className={styles.metricRows}>
          <StatBar label="Wins" a={seasonA.wins} b={seasonB.wins} />
          <StatBar label="Goals" a={seasonA.gf} b={seasonB.gf} />
          <StatBar label="Points" a={seasonA.points} b={seasonB.points} />
        </div>

        <details className={styles.historyDetails}>
          <summary className={styles.historySummary}>Last 4 meetings</summary>
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
