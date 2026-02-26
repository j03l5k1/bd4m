"use client";

import styles from "../briars.module.css";
import type { LadderPayload } from "../page";

function norm(s: string) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
function cleanHeader(s: string) {
  return norm(s).replace(/[^a-z0-9]/g, "");
}
function toNum(s: string | undefined) {
  const n = Number(String(s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function findIdx(headers: string[], wants: string[]) {
  const H = (headers || []).map(cleanHeader);
  for (let i = 0; i < H.length; i++) {
    if (wants.some((w) => H[i] === w || H[i].includes(w))) return i;
  }
  return -1;
}

type Parsed = {
  position: number;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  points: number | null;
};

function parseTeam(ladder: LadderPayload | undefined, teamLabel: string): Parsed | null {
  if (!ladder?.rows?.length) return null;

  const headers = ladder.headers || [];
  const rows = ladder.rows || [];

  const rowIndex = rows.findIndex((r) => norm(r.cols?.[0] || r.team || "") === norm(teamLabel));
  if (rowIndex < 0) return null;

  const cols = rows[rowIndex].cols || [];
  const position = rowIndex + 1;

  const iGames = findIdx(headers, ["games", "played", "gp"]);
  const iWin = findIdx(headers, ["win", "wins", "w"]);
  const iDraw = findIdx(headers, ["draw", "draws", "d"]);
  const iLoss = findIdx(headers, ["loss", "losses", "l"]);
  const iPts = findIdx(headers, ["pts", "points", "point", "p"]);
  const iGF = findIdx(headers, ["gf", "goalsfor", "for"]);
  const iGA = findIdx(headers, ["ga", "goalsagainst", "against"]);
  const iGD = findIdx(headers, ["gd", "goaldiff", "diff"]);

  const played = iGames >= 0 ? toNum(cols[iGames]) : null;
  const wins = iWin >= 0 ? toNum(cols[iWin]) : null;
  const draws = iDraw >= 0 ? toNum(cols[iDraw]) : null;
  const losses = iLoss >= 0 ? toNum(cols[iLoss]) : null;
  const points = iPts >= 0 ? toNum(cols[iPts]) : null;
  const gf = iGF >= 0 ? toNum(cols[iGF]) : null;
  const ga = iGA >= 0 ? toNum(cols[iGA]) : null;

  const gdRaw = iGD >= 0 ? toNum(cols[iGD]) : null;
  const gd = gdRaw !== null ? gdRaw : gf !== null && ga !== null ? gf - ga : null;

  return { position, played, wins, draws, losses, gf, ga, gd, points };
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function shares(a: number | null, b: number | null, lowerIsBetter?: boolean) {
  if (a === null || b === null) return { aPct: 50, bPct: 50 };

  let A = a;
  let B = b;

  if (lowerIsBetter) {
    const max = Math.max(A, B);
    A = max - A;
    B = max - B;
  }

  const total = A + B;
  if (total <= 0) return { aPct: 50, bPct: 50 };

  const aPct = clamp((A / total) * 100, 0, 100);
  return { aPct, bPct: 100 - aPct };
}

function fmtPos(v: number) {
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
  const a = parseTeam(ladder, teamA);
  const b = parseTeam(ladder, teamB);

  const hasStats = !!a && !!b;

  const rows = hasStats
    ? [
        { label: "LEAGUE POSITION", a: fmtPos(a.position), b: fmtPos(b.position), aVal: a.position, bVal: b.position, lowerIsBetter: true },
        { label: "PLAYED", a: a.played ?? "—", b: b.played ?? "—", aVal: a.played, bVal: b.played },
        { label: "WINS", a: a.wins ?? "—", b: b.wins ?? "—", aVal: a.wins, bVal: b.wins },
        { label: "DRAWS", a: a.draws ?? "—", b: b.draws ?? "—", aVal: a.draws, bVal: b.draws },
        { label: "LOSSES", a: a.losses ?? "—", b: b.losses ?? "—", aVal: a.losses, bVal: b.losses, lowerIsBetter: true },
        { label: "GOALS FOR", a: a.gf ?? "—", b: b.gf ?? "—", aVal: a.gf, bVal: b.gf },
        { label: "GOALS AGAINST", a: a.ga ?? "—", b: b.ga ?? "—", aVal: a.ga, bVal: b.ga, lowerIsBetter: true },
        { label: "GOAL DIFF", a: a.gd ?? "—", b: b.gd ?? "—", aVal: a.gd, bVal: b.gd },
        { label: "POINTS", a: a.points ?? "—", b: b.points ?? "—", aVal: a.points, bVal: b.points },
      ]
    : [];

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <span>Head-to-head</span>
        <span className={styles.summaryRight}>{hasStats ? "Season comparison" : "Stats pending"}</span>
      </summary>

      <div className={styles.detailsBody}>
        {!hasStats ? (
          <div className={styles.h2hEmpty}>Couldn’t find both teams in the ladder yet.</div>
        ) : (
          <div className={styles.h2hInfographic}>
            {rows.map((r) => {
              const { aPct, bPct } = shares(r.aVal, r.bVal, r.lowerIsBetter);
              return (
                <div key={r.label} className={styles.h2hInfoRow}>
                  <div className={styles.h2hBarTrack}>
                    <div className={styles.h2hBarFillA} style={{ width: `${aPct}%` }} />
                    <div className={styles.h2hBarFillB} style={{ width: `${bPct}%` }} />
                  </div>

                  <div className={styles.h2hInfoOverlay}>
                    <div className={styles.h2hInfoVal}>{r.a}</div>
                    <div className={styles.h2hInfoLabel}>{r.label}</div>
                    <div className={styles.h2hInfoVal}>{r.b}</div>
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
