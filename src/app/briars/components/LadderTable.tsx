"use client";

import styles from "../briars.module.css";
import type { LadderPayload } from "../../../lib/briars/types";

function safeNum(v: string | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function LadderTable({
  ladder,
}: {
  ladder?: LadderPayload;
}) {
  if (!ladder?.headers?.length || !ladder?.rows?.length) return null;

  const briarsRow = ladder.rows.find((r) =>
    r.team.toLowerCase().includes("briars")
  );

  const briarsPts = briarsRow ? safeNum(briarsRow.cols[8]) : null;
  const briarsPlayed = briarsRow ? safeNum(briarsRow.cols[1]) : null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Ladder</h2>

        <div className={styles.tallyStrip}>
          <span className={styles.tallyPill}>
            Teams {ladder.rows.length}
          </span>

          {briarsPlayed !== null ? (
            <span className={styles.tallyPill}>
              Briars P {briarsPlayed}
            </span>
          ) : null}

          {briarsPts !== null ? (
            <span className={styles.tallyPillStrong}>
              Briars Pts {briarsPts}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.ladderCard}>
        <div className={styles.ladderWrap}>
          <table className={styles.ladder}>
            <thead>
              <tr>
                <th className={styles.ladderTh}>#</th>
                {ladder.headers.map((h) => (
                  <th key={h} className={styles.ladderTh}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {ladder.rows.map((row, idx) => {
                const isBriars = row.team.toLowerCase().includes("briars");

                return (
                  <tr
                    key={`${row.team}-${idx}`}
                    className={isBriars ? styles.ladderBriars : ""}
                  >
                    <td className={styles.ladderTd}>{idx + 1}</td>
                    {row.cols.map((col, colIdx) => (
                      <td key={`${row.team}-${colIdx}`} className={styles.ladderTd}>
                        {col}
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
