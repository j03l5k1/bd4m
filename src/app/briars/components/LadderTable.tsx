"use client";

import styles from "../briars.module.css";
import type { LadderPayload } from "../page";

function toNum(s: string) {
  const n = Number(String(s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function LadderTable({ ladder }: { ladder?: LadderPayload }) {
  if (!ladder?.rows?.length) return null;

  const headers = ladder.headers || [];
  const rows = ladder.rows || [];

  // Find Briars row for the “tally”
  const briarsRow =
    rows.find((r) => (r.cols?.[0] || r.team || "").toLowerCase().includes("briars")) || null;

  // Attempt to infer points if there’s a POINTS column
  const pointsIdx = headers.findIndex((h) => h.toLowerCase().includes("point"));
  const gamesIdx = headers.findIndex((h) => h.toLowerCase() === "games" || h.toLowerCase().includes("played"));
  const winIdx = headers.findIndex((h) => h.toLowerCase() === "win");
  const drawIdx = headers.findIndex((h) => h.toLowerCase() === "draw");
  const lossIdx = headers.findIndex((h) => h.toLowerCase() === "loss");

  const briarsStats = briarsRow?.cols
    ? {
        games: gamesIdx >= 0 ? toNum(briarsRow.cols[gamesIdx]) : null,
        win: winIdx >= 0 ? toNum(briarsRow.cols[winIdx]) : null,
        draw: drawIdx >= 0 ? toNum(briarsRow.cols[drawIdx]) : null,
        loss: lossIdx >= 0 ? toNum(briarsRow.cols[lossIdx]) : null,
        points: pointsIdx >= 0 ? toNum(briarsRow.cols[pointsIdx]) : null,
      }
    : null;

  function isBriars(teamCell: string) {
    return (teamCell || "").toLowerCase().includes("briars");
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Ladder</h2>

        {briarsStats ? (
          <div className={styles.tallyStrip} aria-label="Briars tally">
            {briarsStats.games !== null ? <span className={styles.tallyPill}>GP {briarsStats.games}</span> : null}
            {briarsStats.win !== null ? <span className={styles.tallyPill}>W {briarsStats.win}</span> : null}
            {briarsStats.draw !== null ? <span className={styles.tallyPill}>D {briarsStats.draw}</span> : null}
            {briarsStats.loss !== null ? <span className={styles.tallyPill}>L {briarsStats.loss}</span> : null}
            {briarsStats.points !== null ? <span className={styles.tallyPillStrong}>PTS {briarsStats.points}</span> : null}
          </div>
        ) : null}
      </div>

      <div className={styles.ladderCard}>
        <div className={styles.ladderWrap}>
          <table className={styles.ladder}>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} className={styles.ladderTh}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => {
                const teamCell = r.cols?.[0] || r.team || "";
                return (
                  <tr key={`${teamCell}-${idx}`} className={isBriars(teamCell) ? styles.ladderBriars : ""}>
                    {(r.cols || []).map((c, j) => (
                      <td key={`${idx}-${j}`} className={styles.ladderTd}>
                        {c}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
