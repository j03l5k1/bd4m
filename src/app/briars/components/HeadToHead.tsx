"use client";

import styles from "../briars.module.css";
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

function isSameFixture(a: Game, b: Game) {
  return (
    a.kickoffISO === b.kickoffISO &&
    a.home === b.home &&
    a.away === b.away
  );
}

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
    .slice(0, 3);
}

function MetricRow({
  label,
  a,
  b,
}: {
  label: string;
  a: number;
  b: number;
}) {
  const pct = clampPct(a, b);

  return (
    <div className={styles.h2hCompareRow}>
      <div className={styles.h2hCompareBar}>
        <div className={styles.h2hCompareTrack} />
        <div
          className={styles.h2hCompareFillA}
          style={{ width: `${pct.a}%` }}
        />
        <div
          className={styles.h2hCompareFillB}
          style={{ width: `${pct.b}%` }}
        />
      </div>

      <div className={styles.h2hCompareRowInner}>
        <div className={styles.h2hCompareValA}>{a}</div>
        <div className={styles.h2hCompareLabel}>{label}</div>
        <div className={styles.h2hCompareValB}>{b}</div>
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
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Head to head</h2>

      <div className={styles.h2hCard} style={{ marginTop: 10 }}>
        <div className={styles.h2hCompare}>
          <div className={styles.h2hCompareHeader}>
            <div className={styles.h2hCompareTeam}>{teamA}</div>
            <div className={styles.h2hCompareVs}>VS</div>
            <div className={styles.h2hCompareTeamRight}>{teamB}</div>
          </div>

          <div className={styles.h2hCompareRows}>
            <MetricRow label="Played" a={seasonA.played} b={seasonB.played} />
            <MetricRow label="Wins" a={seasonA.wins} b={seasonB.wins} />
            <MetricRow label="Draws" a={seasonA.draws} b={seasonB.draws} />
            <MetricRow label="Losses" a={seasonA.losses} b={seasonB.losses} />
            <MetricRow label="Goals For" a={seasonA.gf} b={seasonB.gf} />
            <MetricRow label="Goals Against" a={seasonA.ga} b={seasonB.ga} />
            <MetricRow label="Goal Diff" a={seasonA.gd} b={seasonB.gd} />
            <MetricRow label="Points" a={seasonA.points} b={seasonB.points} />
          </div>
        </div>

        <div className={styles.h2hSubSection}>
          <div className={styles.h2hSubTitle}>This matchup</div>

          {h2h.played > 0 ? (
            <div className={styles.h2hInfographic}>
              <div className={styles.h2hInfoRow}>
                <div className={styles.h2hBarTrack}>
                  <div
                    className={styles.h2hBarFillA}
                    style={{ width: `${clampPct(h2h.aWins, h2h.bWins).a}%` }}
                  />
                  <div
                    className={styles.h2hBarFillB}
                    style={{ width: `${clampPct(h2h.aWins, h2h.bWins).b}%` }}
                  />
                </div>

                <div className={styles.h2hInfoOverlay}>
                  <div className={styles.h2hInfoVal}>{h2h.aWins}</div>
                  <div className={styles.h2hInfoLabel}>Wins</div>
                  <div className={styles.h2hInfoVal}>{h2h.bWins}</div>
                </div>
              </div>

              <div className={styles.h2hInfoRow}>
                <div className={styles.h2hBarTrack}>
                  <div
                    className={styles.h2hBarFillA}
                    style={{ width: `${clampPct(h2h.aGF, h2h.bGF).a}%` }}
                  />
                  <div
                    className={styles.h2hBarFillB}
                    style={{ width: `${clampPct(h2h.aGF, h2h.bGF).b}%` }}
                  />
                </div>

                <div className={styles.h2hInfoOverlay}>
                  <div className={styles.h2hInfoVal}>{h2h.aGF}</div>
                  <div className={styles.h2hInfoLabel}>Goals For</div>
                  <div className={styles.h2hInfoVal}>{h2h.bGF}</div>
                </div>
              </div>

              <div className={styles.h2hInfoRow}>
                <div className={styles.h2hBarTrack} />
                <div className={styles.h2hInfoOverlay}>
                  <div className={styles.h2hInfoVal}>{h2h.played}</div>
                  <div className={styles.h2hInfoLabel}>Meetings</div>
                  <div className={styles.h2hInfoVal}>{h2h.draws}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.h2hEmpty}>
              No completed head-to-head results yet. Season totals above are still based on all completed league games.
            </div>
          )}
        </div>

        {recent.length ? (
          <div className={styles.h2hSubSection}>
            <div className={styles.h2hSubTitle}>Last meetings</div>

            <div className={styles.h2hLastList}>
              {recent.map((g) => (
                <div
                  key={`${g.kickoffISO}-${g.home}-${g.away}-h2h`}
                  className={styles.h2hLastRow}
                >
                  <div className={styles.h2hLastTeams}>
                    <div className={styles.h2hLastTeam}>{g.home}</div>
                    <div className={styles.h2hLastScore}>{g.score}</div>
                    <div className={styles.h2hLastTeam}>{g.away}</div>
                  </div>
                  <div className={styles.h2hLastMeta}>
                    {g.date} • {g.time} • {g.venue}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
