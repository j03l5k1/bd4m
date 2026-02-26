"use client";

import styles from "../briars.module.css";
import type { LadderPayload } from "../page";

function norm(s: string) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanHeader(s: string) {
  // "Goals For" -> "goalsfor", "GF" -> "gf"
  return norm(s).replace(/[^a-z0-9]/g, "");
}

function toNum(s: string | undefined) {
  const n = Number(String(s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function idx(headers: string[], wants: string[]) {
  const H = (headers || []).map(cleanHeader);
  for (let i = 0; i < H.length; i++) {
    if (wants.some((w) => H[i] === w || H[i].includes(w))) return i;
  }
  return -1;
}

type Parsed = {
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  points: number | null;
  position: number | null;
};

function parseTeamFromLadder(ladder: LadderPayload | undefined, teamLabel: string): Parsed | null {
  if (!ladder?.rows?.length) return null;

  const headers = ladder.headers || [];
  const rows = ladder.rows || [];

  const rowIndex = rows.findIndex((r) => norm(r.cols?.[0] || r.team || "") === norm(teamLabel));
  if (rowIndex < 0) return null;

  const row = rows[rowIndex];
  const c = row.cols || [];

  // Column indices
  const iTeam = idx(headers, ["team"]);
  const iGames = idx(headers, ["games", "played", "gp"]);
  const iWin = idx(headers, ["win", "wins", "w"]);
  const iDraw = idx(headers, ["draw", "draws", "d"]);
  const iLoss = idx(headers, ["loss", "losses", "l"]);
  const iPts = idx(headers, ["pts", "points", "point", "p"]);
  const iGF = idx(headers, ["gf", "goalsfor", "for"]);
  const iGA = idx(headers, ["ga", "goalsagainst", "against"]);
  const iGD = idx(headers, ["gd", "goaldiff", "diff"]);

  // If the ladder has an explicit position column (sometimes "Pos" or "#"), we *could* parse it,
  // but simplest + stable is: position = row order (1-indexed).
  const position = rowIndex + 1;

  const played = iGames >= 0 ? toNum(c[iGames]) : null;
  const wins = iWin >= 0 ? toNum(c[iWin]) : null;
  const draws = iDraw >= 0 ? toNum(c[iDraw]) : null;
  const losses = iLoss >= 0 ? toNum(c[iLoss]) : null;
  const points = iPts >= 0 ? toNum(c[iPts]) : null;

  const gf = iGF >= 0 ? toNum(c[iGF]) : null;
  const ga = iGA >= 0 ? toNum(c[iGA]) : null;

  const gdRaw = iGD >= 0 ? toNum(c[iGD]) : null;
  const gd = gdRaw !== null ? gdRaw : gf !== null && ga !== null ? gf - ga : null;

  return { played, wins, draws, losses, gf, ga, gd, points, position };
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function barShare(a: number | null, b: number | null, lowerIsBetter?: boolean) {
  if (a === null || b === null) return { aPct: 50, bPct: 50, has: false };

  let A = a;
  let B = b;

  if (lowerIsBetter) {
    const max = Math.max(A, B);
    A = max - A;
    B = max - B;
  }

  const total = A + B;
  if (total <= 0) return { aPct: 50, bPct: 50, has: true };

  const aPct = clamp((A / total) * 100, 0, 100);
  return { aPct, bPct: 100 - aPct, has: true };
}

function fmtPos(v: number | null) {
  if (v === null) return "—";
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
  ladder,
}: {
  teamA: string;
  teamB: string;
  ladder?: LadderPayload;
}) {
  const a = parseTeamFromLadder(ladder, teamA);
  const b = parseTeamFromLadder(ladder, teamB);

  const hasStats = !!a && !!b;

  const rows = hasStats
    ? [
        { label: "League position", a: a.position, b: b.position, lowerIsBetter: true, format: fmtPos },
        { label: "Played", a: a.played, b: b.played },
        { label: "Wins", a: a.wins, b: b.wins },
        { label: "Draws", a: a.draws, b: b.draws },
        { label: "Losses", a: a.losses, b: b.losses, lowerIsBetter: true },
        { label: "Goals for", a: a.gf, b: b.gf },
        { label: "Goals against", a: a.ga, b: b.ga, lowerIsBetter: true },
        { label: "Goal diff", a: a.gd, b: b.gd },
        { label: "Points", a: a.points, b: b.points },
      ]
    : [];

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
          <div className={styles.h2hEmpty}>Couldn’t find both teams in the ladder yet.</div>
        ) : (
          <div className={styles.h2hCompare}>
            <div className={styles.h2hCompareHeader}>
              <div className={styles.h2hCompareTeam}>{teamA}</div>
              <div className={styles.h2hCompareVs}>VS</div>
              <div className={styles.h2hCompareTeamRight}>{teamB}</div>
            </div>

            <div className={styles.h2hCompareRows}>
              {rows.map((r) => {
                const share = barShare(r.a, r.b, (r as any).lowerIsBetter);
                const format = (r as any).format as ((v: any) => string) | undefined;
                const leftText = format ? format(r.a) : r.a === null ? "—" : String(r.a);
                const rightText = format ? format(r.b) : r.b === null ? "—" : String(r.b);

                return (
                  <div key={r.label} className={styles.h2hCompareRow}>
                    <div className={styles.h2hCompareBar}>
                      <div className={styles.h2hCompareTrack} />
                      <div className={styles.h2hCompareFillA} style={{ width: `${share.aPct}%` }} />
                      <div className={styles.h2hCompareFillB} style={{ width: `${share.bPct}%` }} />
                    </div>

                    <div className={styles.h2hCompareRowInner}>
                      <div className={styles.h2hCompareValA}>{leftText}</div>
                      <div className={styles.h2hCompareLabel}>{r.label.toUpperCase()}</div>
                      <div className={styles.h2hCompareValB}>{rightText}</div>
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
