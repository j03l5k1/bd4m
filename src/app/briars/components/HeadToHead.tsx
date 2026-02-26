"use client";

import styles from "../briars.module.css";
import type { Game } from "../page";

type TeamStats = {
  team?: string;
  position?: number; // optional (1st, 2nd, etc)
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

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function pct(a: number, b: number) {
  const total = a + b;
  if (total <= 0) return 50;
  return clamp((a / total) * 100, 0, 100);
}

function fmtPct(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}

function fmtPos(v: number) {
  if (!v) return "—";
  const mod100 = v % 100;
  const mod10 = v % 10;
  let suf = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suf = "st";
    else if (mod10 === 2) suf = "nd";
    else if (mod10 === 3) suf = "rd";
  }
  return `${v}${suf}`;
}

type Row = {
  key: string;
  label: string;
  a: number;
  b: number;
  lowerIsBetter?: boolean;
  format?: (v: number) => string;
};

export default function HeadToHead({
  teamA,
  teamB,
  teamAStats,
  teamBStats,
  allGames, // kept for compatibility with your current usage
}: {
  teamA: string;
  teamB: string;
  teamAStats?: TeamStats | null;
  teamBStats?: TeamStats | null;
  allGames: Game[];
}) {
  const hasStats = !!teamAStats && !!teamBStats;

  const aPos = n(teamAStats?.position);
  const bPos = n(teamBStats?.position);

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

  const aGD =
    teamAStats?.gd !== undefined && teamAStats?.gd !== null
      ? n(teamAStats?.gd)
      : aGF - aGA;
  const bGD =
    teamBStats?.gd !== undefined && teamBStats?.gd !== null
      ? n(teamBStats?.gd)
      : bGF - bGA;

  const aPts = n(teamAStats?.points);
  const bPts = n(teamBStats?.points);

  const aWinRate = aPlayed ? (aW / aPlayed) * 100 : 0;
  const bWinRate = bPlayed ? (bW / bPlayed) * 100 : 0;

  // Build rows. We include Position only if provided (non-zero).
  const rows: Row[] = [
    ...(aPos && bPos
      ? [
          {
            key: "pos",
            label: "League position",
            a: aPos,
            b: bPos,
            lowerIsBetter: true,
            format: (v) => fmtPos(v),
          } as Row,
        ]
      : []),
    { key: "played", label: "Played", a: aPlayed, b: bPlayed },
    { key: "wins", label: "Wins", a: aW, b: bW },
    { key: "winrate", label: "Win rate", a: aWinRate, b: bWinRate, format: (v) => fmtPct(v) },
    { key: "gf", label: "Goals for", a: aGF, b: bGF },
    { key: "ga", label: "Goals against", a: aGA, b: bGA, lowerIsBetter: true },
    { key: "gd", label: "Goal diff", a: aGD, b: bGD },
    { key: "pts", label: "Points", a: aPts, b: bPts },
  ];

  function barPercents(row: Row) {
    // For lower-is-better metrics (GA, Losses, Position), invert values.
    let a = row.a;
    let b = row.b;

    if (row.lowerIsBetter) {
      const max = Math.max(a, b);
      // invert so "better (lower)" becomes higher value
      a = max - a;
      b = max - b;
    }

    const aPct = pct(a, b);
    const bPct = 100 - aPct;
    return { aPct, bPct };
  }

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <span>Head-to-head</span>
        <span className={styles.summaryRight}>
          {hasStats ? "Season comparison" : "Stats pending"}
        </span>
      </summary>

      <div className={styles.detailsBody}>
        {!hasStats ? (
          <div className={styles.h2hEmpty}>
            Stats not available for one or both teams.
          </div>
        ) : (
          <div className={styles.h2hCompare}>
            <div className={styles.h2hCompareHeader}>
              <div className={styles.h2hCompareTeam}>{teamA}</div>
              <div className={styles.h2hCompareVs}>VS</div>
              <div className={styles.h2hCompareTeamRight}>{teamB}</div>
            </div>

            <div className={styles.h2hCompareRows}>
              {rows.map((r) => {
                const { aPct, bPct } = barPercents(r);
                const format = r.format ?? ((v: number) => String(v));
                return (
                  <div key={r.key} className={styles.h2hCompareRow}>
                    <div className={styles.h2hCompareBar}>
                      <div className={styles.h2hCompareTrack} />
                      <div
                        className={styles.h2hCompareFillA}
                        style={{ width: `${aPct}%` }}
                      />
                      <div
                        className={styles.h2hCompareFillB}
                        style={{ width: `${bPct}%` }}
                      />
                    </div>

                    <div className={styles.h2hCompareRowInner}>
                      <div className={styles.h2hCompareValA}>
                        {format(r.a)}
                      </div>

                      <div className={styles.h2hCompareLabel}>
                        {r.label}
                      </div>

                      <div className={styles.h2hCompareValB}>
                        {format(r.b)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
