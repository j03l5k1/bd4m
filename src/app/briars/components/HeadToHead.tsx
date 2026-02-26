"use client";

import styles from "../briars.module.css";
import type { Game } from "../page";

function normTeam(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripGradeSuffix(s: string) {
  // "briars 3" -> "briars"
  // "macquarie uni 2" -> "macquarie uni"
  // also handles "briars iii" etc
  return String(s || "")
    .replace(/\b(1st|2nd|3rd|4th|5th)\b/gi, "")
    .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/gi, "")
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sameTeam(a: string, b: string) {
  const A0 = normTeam(a);
  const B0 = normTeam(b);

  if (!A0 || !B0) return false;
  if (A0 === B0) return true;

  // try without grade suffixes
  const A = normTeam(stripGradeSuffix(A0));
  const B = normTeam(stripGradeSuffix(B0));
  if (A && B && A === B) return true;

  // prefix matching (macquarie vs macquarie uni 2)
  if (A0.startsWith(B0) || B0.startsWith(A0)) return true;
  if (A.startsWith(B) || B.startsWith(A)) return true;

  // first-word fallback
  const aFirst = A.split(" ")[0];
  const bFirst = B.split(" ")[0];
  if (aFirst && bFirst && aFirst === bFirst) return true;

  return false;
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
  const relevant = allGames.filter((g: any) => {
    const homeVsAway = sameTeam(g.home, teamA) && sameTeam(g.away, teamB);
    const awayVsHome = sameTeam(g.home, teamB) && sameTeam(g.away, teamA);
    return homeVsAway || awayVsHome;
  });

  let out: H2H = {
    played: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aGF: 0,
    aGA: 0,
    bGF: 0,
    bGA: 0,
  };

  for (const g of relevant as any[]) {
    const s = parseScore((g as any).score);
    if (!s) continue;

    let scoreA = 0;
    let scoreB = 0;

    if (sameTeam((g as any).home, teamA) && sameTeam((g as any).away, teamB)) {
      scoreA = s.a;
      scoreB = s.b;
    } else if (
      sameTeam((g as any).home, teamB) &&
      sameTeam((g as any).away, teamA)
    ) {
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

type LadderRow = Record<string, any>;

function asArrayLadder(input: any): LadderRow[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.rows)) return input.rows;
  if (Array.isArray(input.data)) return input.data;
  if (Array.isArray(input.ladder)) return input.ladder;
  return [];
}

function getTeamLabel(row: LadderRow | undefined) {
  if (!row) return "";

  // 1) exact common keys first
  const direct =
    row.team ??
    row.Team ??
    row.teamName ??
    row.TeamName ??
    row["Team Name"] ??
    row.name ??
    row.Name ??
    row.club ??
    row.Club ??
    row["Club Name"] ??
    row["Club"] ??
    row["TEAM"] ??
    row["Team"];

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  // 2) any key that looks like team/club/name
  for (const k of Object.keys(row)) {
    const lk = k.toLowerCase();
    if (lk.includes("team") || lk.includes("club") || lk === "name") {
      const v = row[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  // 3) first string value in the row
  for (const v of Object.values(row)) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  return "";
}

function getNum(row: LadderRow | undefined, keys: string[], fallback = 0) {
  if (!row) return fallback;
  for (const k of keys) {
    const v = row[k];
    if (v === 0) return 0;
    if (v === null || v === undefined) continue;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (Number.isFinite(n)) return n;
  }

  // last-ditch: try case-insensitive match on keys
  const lowerMap = new Map<string, any>();
  for (const [k, v] of Object.entries(row)) lowerMap.set(k.toLowerCase(), v);
  for (const k of keys) {
    const v = lowerMap.get(String(k).toLowerCase());
    if (v === 0) return 0;
    if (v === null || v === undefined) continue;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (Number.isFinite(n)) return n;
  }

  return fallback;
}

function findLadderRow(ladder: LadderRow[], team: string) {
  return ladder.find((r) => sameTeam(getTeamLabel(r), team));
}

export default function HeadToHead({
  allGames,
  ladder,
  teamA,
  teamB,
}: {
  allGames: Game[];
  ladder?: any; // accept array OR wrapper object
  teamA: string;
  teamB: string;
}) {
  const ladderArr = asArrayLadder(ladder);

  const aRow = findLadderRow(ladderArr, teamA);
  const bRow = findLadderRow(ladderArr, teamB);

  const ladderReady = !!aRow && !!bRow;

  // Debug if ladder isn’t matching (check browser console)
  if (!ladderReady && ladderArr.length) {
    // logs first row keys so we can see the schema
    console.warn("[HeadToHead] Ladder match failed", {
      teamA,
      teamB,
      ladderFirstRowKeys: Object.keys(ladderArr[0] || {}),
      sampleTeamLabels: ladderArr.slice(0, 5).map((r) => getTeamLabel(r)),
    });
  }
  if (!ladderArr.length) {
    console.warn("[HeadToHead] Ladder missing/empty — ensure you pass `ladder` prop");
  }

  // ladder numbers
  const aW = getNum(aRow, ["w", "W", "wins", "Wins", "won", "Won"]);
  const aD = getNum(aRow, ["d", "D", "draws", "Draws", "drawn", "Drawn"]);
  const aL = getNum(aRow, ["l", "L", "losses", "Losses", "lost", "Lost"]);
  const aGF = getNum(aRow, ["gf", "GF", "goalsfor", "goalsFor", "Goals For", "goals_for"]);
  const aGA = getNum(aRow, ["ga", "GA", "goalsagainst", "goalsAgainst", "Goals Against", "goals_against"]);
  const aGD = getNum(aRow, ["gd", "GD", "diff", "Diff", "goaldiff", "goalDiff", "Goal Diff", "goal_diff"], aGF - aGA);
  const aPts = getNum(aRow, ["pts", "PTS", "points", "Points", "P"]);

  const bW = getNum(bRow, ["w", "W", "wins", "Wins", "won", "Won"]);
  const bD = getNum(bRow, ["d", "D", "draws", "Draws", "drawn", "Drawn"]);
  const bL = getNum(bRow, ["l", "L", "losses", "Losses", "lost", "Lost"]);
  const bGF = getNum(bRow, ["gf", "GF", "goalsfor", "goalsFor", "Goals For", "goals_for"]);
  const bGA = getNum(bRow, ["ga", "GA", "goalsagainst", "goalsAgainst", "Goals Against", "goals_against"]);
  const bGD = getNum(bRow, ["gd", "GD", "diff", "Diff", "goaldiff", "goalDiff", "Goal Diff", "goal_diff"], bGF - bGA);
  const bPts = getNum(bRow, ["pts", "PTS", "points", "Points", "P"]);

  // true H2H from scored fixtures between them
  const h2h = computeH2H(allGames, teamA, teamB);
  const aWinPct = pct(h2h.aWins, h2h.played);
  const bWinPct = pct(h2h.bWins, h2h.played);

  return (
    <details className={styles.details} open>
      <summary className={styles.summary}>
        <span>Head-to-head</span>
        <span className={styles.summaryRight}>
          {ladderReady ? "Season comparison" : "Comparison pending"}
        </span>
      </summary>

      <div className={styles.detailsBody}>
        <div className={styles.h2hGrid}>
          {/* Season comparison (ladder-based) */}
          <div className={styles.h2hCard}>
            <div className={styles.h2hLabel}>Season comparison</div>

            {!ladderReady ? (
              <div className={styles.h2hEmpty}>
                Couldn’t match both teams to the ladder yet.
                <br />
                <span style={{ opacity: 0.75 }}>
                  ({teamA} vs {teamB})
                </span>
              </div>
            ) : (
              <>
                <div className={styles.h2hEdgeRow}>
                  <div className={styles.h2hTeamName}>{teamA}</div>
                  <div className={styles.h2hMid}>vs</div>
                  <div className={styles.h2hTeamName}>{teamB}</div>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Wins</span>
                  <span className={styles.h2hStatNums}>
                    {aW} : {bW}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Draws</span>
                  <span className={styles.h2hStatNums}>
                    {aD} : {bD}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Losses</span>
                  <span className={styles.h2hStatNums}>
                    {aL} : {bL}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals for</span>
                  <span className={styles.h2hStatNums}>
                    {aGF} : {bGF}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals against</span>
                  <span className={styles.h2hStatNums}>
                    {aGA} : {bGA}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goal diff</span>
                  <span className={styles.h2hStatNums}>
                    {aGD} : {bGD}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Points</span>
                  <span className={styles.h2hStatNums}>
                    {aPts} : {bPts}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Previous meetings (fixture-scored H2H) */}
          <div className={styles.h2hCard}>
            <div className={styles.h2hLabel}>Previous meetings</div>

            {h2h.played === 0 ? (
              <div className={styles.h2hEmpty}>
                No scored matches between these two yet.
              </div>
            ) : (
              <>
                <div className={styles.h2hEdgeRow}>
                  <div className={styles.h2hTeamName}>{teamA}</div>
                  <div className={styles.h2hMid}>vs</div>
                  <div className={styles.h2hTeamName}>{teamB}</div>
                </div>

                <div className={styles.h2hBarWrap}>
                  <div className={styles.h2hBarTrack}>
                    <div
                      className={styles.h2hBarFillA}
                      style={{ width: `${aWinPct}%` }}
                    />
                    <div
                      className={styles.h2hBarFillB}
                      style={{ width: `${bWinPct}%` }}
                    />
                  </div>
                  <div className={styles.h2hBarLegend}>
                    <span>
                      {teamA}: {aWinPct}% wins
                    </span>
                    <span>
                      {teamB}: {bWinPct}% wins
                    </span>
                  </div>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Wins</span>
                  <span className={styles.h2hStatNums}>
                    {h2h.aWins} : {h2h.bWins}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals for</span>
                  <span className={styles.h2hStatNums}>
                    {h2h.aGF} : {h2h.bGF}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Goals against</span>
                  <span className={styles.h2hStatNums}>
                    {h2h.aGA} : {h2h.bGA}
                  </span>
                </div>

                <div className={styles.h2hStatRow}>
                  <span>Draws</span>
                  <span className={styles.h2hStatNums}>{h2h.draws}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
