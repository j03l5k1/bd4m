"use client";

import styles from "../briars.module.css";
import type { LadderPayload } from "../page";

export default function LadderTable({ ladder }: { ladder?: LadderPayload }) {
  if (!ladder?.rows?.length) return null;

  const headers = ladder.headers || [];
  const rows = ladder.rows || [];

  // Light highlight for Briars rows
  function isBriars(teamCell: string) {
    return (teamCell || "").toLowerCase().includes("briars");
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Ladder</h2>

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
    </section>
  );
}
