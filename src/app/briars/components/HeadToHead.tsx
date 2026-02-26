"use client";

import styles from "../briars.module.css";
import type { Game } from "../page";

function normTeam(s: string) {
  return s.trim().toLowerCase();
}

function parseScore(score: string): { a: number; b: number } | null {
  // supports: "2-1", "2–1", "2 — 1", "2 : 1" etc
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
  const A = normTeam(teamA);
  const B = normTeam(teamB);

  const relevant = allGames.filter((g) => {
    const h = normTeam(g.home);
    const a = normTeam(g.away);
    return (h === A && a === B) || (h === B && a === A);
  });

  let out: H2H = { played: 0, aWins: 0, bWins: 0, draws: 0, aGF: 0, aGA: 0, bGF: 0, bGA: 0 };

  for (const g of relevant) {
    const s = parseScore(g.score);
    if (!s) continue;

    // Determine score relative to A/B regardless of home/away orientation
    const h = normTeam(g.home);
    const a = normTeam(g.away);

    let scoreA = 0;
    let scoreB = 0;

    if (h === A && a === B) {
      scoreA = s.a;
      scoreB = s.b;
    } else if (h === B && a === A) {
      scoreA = s.b;
      scoreB = s.a;
    } else {
      continue;
    }

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

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export default function HeadToHead({
  allGames,
  teamA,
  teamB,
}: {
  allGames: Game[];
  teamA: string;
  teamB: string;
}) {
  const h2h = computeH2H(allGames, teamA, teamB);

  // If we have no scored matches, keep it clean
  if (h2h.played === 0) {
    return (
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span>Head-to-head</span>
          <span className={styles.summaryRight}>No scored matches yet</span>
        </summary>
        <div className={styles.detailsBody}>
          <div className={styles.h2hEmpty}>Once scores are available, you’ll see a clean comparison here.</div>
        </div>
      </details>
    );
  }

  const aWinPct = pct(h2h.aWins, h2h.played);
  const bWinPct = pct(h2h.bWins, h2h.played);

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <span>Head-to-head</span>
        <span className={styles.summaryRight}>
          {h2h.played} matches • {h2h.aWins}-{h2h.draws}-{h2h.bWins}
        </span>
      </summary>

      <div className={styles.detailsBody}>
        <div className={styles.h2hGrid}>
          <div className={styles.h2hCard}>
            <div className={styles.h2hLabel}>Edge</div>
            <div className={styles.h2hEdgeRow}>
              <div className={styles.h2hTeamName}>{teamA}</div>
              <div className={styles.h2hMid}>vs</div>
              <div className={styles.h2hTeamName}>{teamB}</div>
            </div>

            <div className={styles.h2hBarWrap}>
              <div className={styles.h2hBarTrack}>
                <div className={styles.h2hBarFillA} style={{ width: `${aWinPct}%` }} />
                <div className={styles.h2hBarFillB} style={{ width: `${bWinPct}%` }} />
              </div>
              <div className={styles.h2hBarLegend}>
                <span>{teamA}: {aWinPct}% wins</span>
                <span>{teamB}: {bWinPct}% wins</span>
              </div>
            </div>
          </div>

          <div className={styles.h2hCard}>
            <div className={styles.h2hLabel}>Key stats</div>

            <div className={styles.h2hStatRow}>
              <span>Wins</span>
              <span className={styles.h2hStatNums}>{h2h.aWins} : {h2h.bWins}</span>
            </div>

            <div className={styles.h2hStatRow}>
              <span>Goals for</span>
              <span className={styles.h2hStatNums}>{h2h.aGF} : {h2h.bGF}</span>
            </div>

            <div className={styles.h2hStatRow}>
              <span>Goals against</span>
              <span className={styles.h2hStatNums}>{h2h.aGA} : {h2h.bGA}</span>
            </div>

            <div className={styles.h2hStatRow}>
              <span>Draws</span>
              <span className={styles.h2hStatNums}>{h2h.draws}</span>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
