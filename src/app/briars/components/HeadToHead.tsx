"use client";

import styles from "../briars.module.css";
import type { Game } from "../page";

type TeamStats = {
  team?: string;
  position?: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  gf?: number;
  ga?: number;
  gd?: number;
  points?: number;
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function sharePct(a: number, b: number) {
  const total = a + b;
  if (total <= 0) return 50;
  return clamp((a / total) * 100, 0, 100);
}

function fmtPos(v?: number) {
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

export default function HeadToHead({
  teamA,
  teamB,
  teamAStats,
  teamBStats,
  allGames, // kept for compatibility
}: {
  teamA: string;
  teamB: string;
  teamAStats?: TeamStats | null;
  teamBStats?: TeamStats | null;
  allGames: Game[];
}) {
  const hasStats = !!teamAStats && !!teamBStats;

  const rows = hasStats
    ? [
        { label: "LEAGUE POSITION", a: teamAStats?.position ?? null, b: teamBStats?.position ?? null, lowerIsBetter: true, format: (v: number | null) => fmtPos(v ?? undefined) },
        { label: "PLAYED", a: teamAStats?.played ?? null, b: teamBStats?.played ?? null },
        { label: "WINS", a: teamAStats?.wins ?? null, b: teamBStats?.wins ?? null },
        { label: "DRAWS", a: teamAStats?.draws ?? null, b: teamBStats?.draws ?? null },
        { label: "LOSSES", a: teamAStats?.losses ?? null, b: teamBStats?.losses ?? null, lowerIsBetter: true },
        { label: "GOALS FOR", a: teamAStats?.gf ?? null, b: teamBStats?.gf ?? null },
        { label: "GOALS AGAINST", a: teamAStats?.ga ?? null, b: teamBStats?.ga ?? null, lowerIsBetter: true },
        { label: "GOAL DIFF", a: (teamAStats?.gd ?? null) as number | null, b: (teamBStats?.gd ?? null) as number | null },
        { label: "POINTS", a: teamAStats?.points ?? null, b: teamBStats?.points ?? null },
      ]
    : [];

  function bar(a: number | null, b: number | null, lowerIsBetter?: boolean) {
    if (a === null || b === null) return { aPct: 50, bPct: 50 };

    let A = a;
    let B = b;

    if (lowerIsBetter) {
      const max = Math.max(A, B);
      A = max - A;
      B = max - B;
    }

    const aPct = sharePct(A, B);
    return { aPct, bPct: 100 - aPct };
  }

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <span>Head-to-head</span>
        <span className={styles.summaryRight}>{hasStats ? "Season comparison" : "Stats pending"}</span>
      </summary>

      <div className={styles.detailsBody}>
        {!hasStats ? (
          <div className={styles.h2hEmpty}>Couldn’t match both teams to the ladder yet.</div>
        ) : (
          <div className={styles.h2hInfographic}>
            {rows.map((r) => {
              const { aPct, bPct } = bar(r.a, r.b, (r as any).lowerIsBetter);
              const format = (r as any).format as ((v: number | null) => string) | undefined;

              const left = format ? format(r.a) : r.a === null ? "—" : String(r.a);
              const right = format ? format(r.b) : r.b === null ? "—" : String(r.b);

              return (
                <div key={r.label} className={styles.h2hInfoRow}>
                  <div className={styles.h2hBarTrack}>
                    <div className={styles.h2hBarFillA} style={{ width: `${aPct}%` }} />
                    <div className={styles.h2hBarFillB} style={{ width: `${bPct}%` }} />
                  </div>

                  <div className={styles.h2hInfoOverlay}>
                    <div className={styles.h2hInfoVal}>{left}</div>
                    <div className={styles.h2hInfoLabel}>{r.label}</div>
                    <div className={styles.h2hInfoVal}>{right}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
