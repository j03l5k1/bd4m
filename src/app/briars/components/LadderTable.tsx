"use client";

import { useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import ui from "../briars.module.css";
import styles from "../ladder.module.css";
import type { LadderPayload } from "../../../lib/briars/types";

function safeNum(v: string | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const EXPECTED_HEADERS = ["Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"];

type SortState = {
  key: "position" | number;
  direction: "asc" | "desc";
};

export default function LadderTable({
  ladder,
}: {
  ladder?: LadderPayload;
}) {
  if (!ladder?.headers?.length || !ladder?.rows?.length) return null;

  const [sort, setSort] = useState<SortState>({ key: "position", direction: "asc" });

  const normalizedRows = useMemo(() => {
    const headerIndex = new Map(
      ladder.headers.map((header, idx) => [header.trim().toLowerCase(), idx])
    );

    return ladder.rows.map((row, idx) => {
      const padded = [...row.cols];
      while (padded.length < ladder.headers.length) padded.push("0");

      const normalizedCols = EXPECTED_HEADERS.map((header) => {
        const sourceIdx = headerIndex.get(header.toLowerCase());
        if (sourceIdx === undefined) {
          return header === "Team" ? row.team : "0";
        }
        return padded[sourceIdx] ?? (header === "Team" ? row.team : "0");
      });

      return {
        team: row.team,
        cols: normalizedCols,
        position: idx + 1,
      };
    });
  }, [ladder]);

  const sortedRows = useMemo(() => {
    const rows = [...normalizedRows];

    rows.sort((a, b) => {
      let compare = 0;

      if (sort.key === "position") {
        compare = a.position - b.position;
      } else if (sort.key === 0) {
        compare = a.cols[0].localeCompare(b.cols[0]);
      } else {
        compare = safeNum(a.cols[sort.key]) - safeNum(b.cols[sort.key]);
      }

      return sort.direction === "asc" ? compare : -compare;
    });

    return rows;
  }, [normalizedRows, sort]);

  const briarsRow = sortedRows.find((r) =>
    r.team.toLowerCase().includes("briars")
  );

  const briarsPts = briarsRow ? safeNum(briarsRow.cols[8]) : null;
  const briarsPlayed = briarsRow ? safeNum(briarsRow.cols[1]) : null;

  function applySort(nextKey: SortState["key"]) {
    setSort((prev) => {
      if (prev.key === nextKey) {
        return {
          key: nextKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: nextKey, direction: "asc" };
    });
  }

  function SortIndicator({
    isActive,
    direction,
  }: {
    isActive: boolean;
    direction: "asc" | "desc";
  }) {
    if (!isActive) return <span className={styles.sortGhost}>↕</span>;
    return direction === "asc" ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />;
  }

  return (
    <section className={ui.section}>
      <div className={styles.sectionHead}>
        <h2 className={ui.sectionTitle}>Ladder</h2>

        <div className={styles.tallyStrip}>
          <span className={styles.tallyPill}>Teams {ladder.rows.length}</span>

          {briarsPlayed !== null ? (
            <span className={styles.tallyPill}>Briars P {briarsPlayed}</span>
          ) : null}

          {briarsPts !== null ? (
            <span className={styles.tallyPillStrong}>Briars Pts {briarsPts}</span>
          ) : null}
        </div>
      </div>

      <div className={styles.ladderCard}>
        <div className={styles.ladderWrap}>
          <table className={styles.ladder}>
            <thead>
              <tr>
                <th className={styles.ladderTh}>
                  <button
                    type="button"
                    className={styles.sortBtn}
                    onClick={() => applySort("position")}
                  >
                    <span>#</span>
                    <SortIndicator isActive={sort.key === "position"} direction={sort.direction} />
                  </button>
                </th>
                {EXPECTED_HEADERS.map((h, idx) => (
                  <th key={h} className={styles.ladderTh}>
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => applySort(idx)}
                    >
                      <span>{h}</span>
                      <SortIndicator isActive={sort.key === idx} direction={sort.direction} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row) => {
                const isBriars = row.team.toLowerCase().includes("briars");

                return (
                  <tr
                    key={`${row.team}-${row.position}`}
                    className={isBriars ? styles.ladderBriars : ""}
                  >
                    <td className={styles.ladderTd}>{row.position}</td>
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
