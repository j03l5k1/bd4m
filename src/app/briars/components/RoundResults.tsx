"use client";

import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import ui from "../briars.module.css";
import styles from "../roundresults.module.css";
import { buildRoundMap, buildSourceKey, parseScore } from "../../../lib/briars/format";
import { getTeamMeta } from "../../../lib/briars/teamMeta";
import type { Game } from "../../../lib/briars/types";

type Counts = { yes: number; maybe: number; no: number };

function isBriarsGame(g: Game) {
  return g.home.toLowerCase().includes("briars") || g.away.toLowerCase().includes("briars");
}

function MiniLogo({ name }: { name: string }) {
  const meta = getTeamMeta(name);
  const [failed, setFailed] = useState(false);
  const fallback = meta.shortName.slice(0, 1).toUpperCase();

  if (meta.logoUrl && !failed) {
    return (
      <img
        src={meta.logoUrl}
        alt={meta.shortName}
        className={styles.rrLogo}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return <div className={styles.rrLogoWrap}>{fallback}</div>;
}

export default function RoundResults({ allGames }: { allGames: Game[] }) {
  const roundMap = buildRoundMap(allGames);

  const roundGroups = new Map<number, Game[]>();
  for (const game of allGames) {
    const rnd = roundMap.get(game.kickoffISO.slice(0, 10));
    if (rnd === undefined) continue;
    if (!roundGroups.has(rnd)) roundGroups.set(rnd, []);
    roundGroups.get(rnd)!.push(game);
  }

  const rounds = [...roundGroups.keys()].sort((a, b) => a - b);
  if (!rounds.length) return null;

  const completedRounds = rounds.filter((rnd) =>
    roundGroups.get(rnd)!.some((g) => !!parseScore(g.score))
  );
  const defaultRound = completedRounds.length
    ? completedRounds[completedRounds.length - 1]
    : rounds[0];

  const [activeRound, setActiveRound] = useState(defaultRound);
  const [avail, setAvail] = useState<Record<string, Counts>>({});

  const roundIdx = rounds.indexOf(activeRound);
  const games = (roundGroups.get(activeRound) ?? []).sort(
    (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
  );

  // Fetch availability counts for upcoming Briars games in the active round
  useEffect(() => {
    const upcoming = games.filter((g) => isBriarsGame(g) && !parseScore(g.score));
    if (!upcoming.length) { setAvail({}); return; }

    Promise.all(
      upcoming.map(async (g) => {
        const key = buildSourceKey(g);
        try {
          const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(key)}`);
          const json = await res.json();
          return { key, counts: json.ok ? (json.counts as Counts) : null };
        } catch {
          return { key, counts: null };
        }
      })
    ).then((results) => {
      const map: Record<string, Counts> = {};
      for (const { key, counts } of results) {
        if (counts) map[key] = counts;
      }
      setAvail(map);
    });
  }, [activeRound]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className={ui.section}>
      <details className={styles.rrCard}>
        <summary className={styles.rrSummary}>
          <span className={styles.rrTitle}>Round results</span>
          <div
            className={styles.rrNav}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.rrNavBtn}
              disabled={roundIdx <= 0}
              onClick={() => setActiveRound(rounds[roundIdx - 1])}
              aria-label="Previous round"
            >
              <FiChevronLeft size={13} />
            </button>
            <span className={styles.rrRoundLabel}>Rd {activeRound}</span>
            <button
              type="button"
              className={styles.rrNavBtn}
              disabled={roundIdx >= rounds.length - 1}
              onClick={() => setActiveRound(rounds[roundIdx + 1])}
              aria-label="Next round"
            >
              <FiChevronRight size={13} />
            </button>
          </div>
        </summary>

        <div className={styles.rrBody}>
          {games.map((g) => {
            const score = parseScore(g.score);
            const homeMeta = getTeamMeta(g.home);
            const awayMeta = getTeamMeta(g.away);
            const homeWon = score ? score.a > score.b : false;
            const awayWon = score ? score.b > score.a : false;
            const counts = !score && isBriarsGame(g) ? avail[buildSourceKey(g)] : undefined;

            return (
              <div key={`${g.kickoffISO}-${g.home}-${g.away}`} className={styles.rrRow}>
                <div className={styles.rrHome}>
                  <MiniLogo name={g.home} />
                  <span className={`${styles.rrTeamName} ${homeWon ? styles.rrTeamWinner : ""}`}>
                    {homeMeta.shortName}
                  </span>
                </div>
                <div className={styles.rrCentre}>
                  <span className={`${styles.rrScore} ${!score ? styles.rrScorePending : ""}`}>
                    {score ? g.score : "vs"}
                  </span>
                  {counts ? (
                    <div className={styles.rrAvail}>
                      <span className={styles.rrAvailYes}>✓ {counts.yes}</span>
                      <span className={styles.rrAvailMaybe}>? {counts.maybe}</span>
                      <span className={styles.rrAvailNo}>✗ {counts.no}</span>
                    </div>
                  ) : null}
                </div>
                <div className={styles.rrAway}>
                  <span className={`${styles.rrTeamName} ${awayWon ? styles.rrTeamWinner : ""}`}>
                    {awayMeta.shortName}
                  </span>
                  <MiniLogo name={g.away} />
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
