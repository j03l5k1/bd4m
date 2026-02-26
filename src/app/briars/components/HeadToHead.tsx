// (the full file is exactly what you saw above in my implementation)
// Paste this whole file as-is:

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

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function baseTeam(s: string) {
  // "Macquarie Uni 2" => "macquarie uni"
  return norm(s).replace(/\s+\d+$/, "");
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

function winnerTag(a: number, b: number) {
  if (a > b) return "W";
  if (a < b) return "L";
  return "D";
}

function outcomePillClass(outcome: "W" | "L" | "D") {
  if (outcome === "W") return styles.formPillWin;
  if (outcome === "L") return styles.formPillLoss;
  return styles.formPillDraw;
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

  const aBase = baseTeam(teamA);
  const bBase = baseTeam(teamB);

  const gamesBetween = allGames
    .filter((g) => {
      const h = baseTeam(g.home);
      const a = baseTeam(g.away);
      return (h === aBase && a === bBase) || (h === bBase && a === aBase);
    })
    .filter((g) => !!parseScore(g.score));

  const lastH2H = [...gamesBetween]
    .sort((x, y) => new Date(y.kickoffISO).getTime() - new Date(x.kickoffISO).getTime())
    .slice(0, 3);

  function teamRecent(team: string, n = 5) {
    const t = baseTeam(team);
    const games = allGames
      .filter((g) => baseTeam(g.home) === t || baseTeam(g.away) === t)
      .filter((g) => !!parseScore(g.score))
      .sort((x, y) => new Date(y.kickoffISO).getTime() - new Date(x.kickoffISO).getTime())
      .slice(0, n);

    return games.map((g) => {
      const s = parseScore(g.score)!;
      const isHome = baseTeam(g.home) === t;
      const us = isHome ? s.a : s.b;
      const them = isHome ? s.b : s.a;
      const outcome = winnerTag(us, them) as "W" | "L" | "D";
      const opp = isHome ? g.away : g.home;
      return { outcome, us, them, opp, roundLabel: g.roundLabel, date: g.date };
    });
  }

  const aForm = teamRecent(teamA, 5);
  const bForm = teamRecent(teamB, 5);

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
        <span className={styles.summaryRight}>
          {hasStats ? "Season comparison" : "Stats pending"}
          {gamesBetween.length ? ` • H2H ${gamesBetween.length} games` : ""}
        </span>
      </summary>

      <div className={styles.detailsBody}>
        {!hasStats ? <div className={styles.h2hEmpty}>Couldn’t match both teams to the ladder yet.</div> : null}

        {hasStats ? (
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
        ) : null}

        {lastH2H.length ? (
          <div className={styles.h2hSubSection}>
            <div className={styles.h2hSubTitle}>Last matches played</div>
            <div className={styles.h2hLastList}>
              {lastH2H.map((g) => (
                <div key={`${g.kickoffISO}|${g.home}|${g.away}`} className={styles.h2hLastRow}>
                  <div className={styles.h2hLastTeams}>
                    <span className={styles.h2hLastTeam}>{g.home}</span>
                    <span className={styles.h2hLastScore}>{g.score}</span>
                    <span className={styles.h2hLastTeam}>{g.away}</span>
                  </div>
                  <div className={styles.h2hLastMeta}>{g.roundLabel ? `${g.roundLabel} • ` : ""}{g.date}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(aForm.length || bForm.length) ? (
          <div className={styles.h2hSubSection}>
            <div className={styles.h2hSubTitle}>Form guide</div>
            <div className={styles.formGrid}>
              <div className={styles.formCol}>
                <div className={styles.formTeamTitle}>{teamA}</div>
                <div className={styles.formPills}>
                  {aForm.map((x, i) => (
                    <span key={`${x.date}|${i}`} className={`${styles.formPill} ${outcomePillClass(x.outcome)}`} title={`${x.us}-${x.them} vs ${x.opp}`}>
                      {x.outcome}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.formCol}>
                <div className={styles.formTeamTitle}>{teamB}</div>
                <div className={styles.formPills}>
                  {bForm.map((x, i) => (
                    <span key={`${x.date}|${i}`} className={`${styles.formPill} ${outcomePillClass(x.outcome)}`} title={`${x.us}-${x.them} vs ${x.opp}`}>
                      {x.outcome}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
