"use client";

import styles from "../briars.module.css";
import AvailabilityBlock from "./AvailabilityBlock";

import {
  formatDayDateFromSource,
  formatLongDateFromSource,
  formatTimeFromSource,
} from "../../../lib/briars/format";
import type { Game, LadderPayload, Weather } from "../../../lib/briars/types";

function getTeamPosition(ladder: LadderPayload | undefined, teamName: string) {
  if (!ladder?.rows?.length) return null;
  const idx = ladder.rows.findIndex((r) => r.team === teamName);
  if (idx === -1) return null;
  return idx + 1;
}

function positionLabel(pos: number | null) {
  if (!pos) return null;
  if (pos === 1) return "🥇 1st";
  if (pos === 2) return "🥈 2nd";
  if (pos === 3) return "🥉 3rd";
  if (pos === 21 || pos === 31) return `${pos}st`;
  if (pos === 22 || pos === 32) return `${pos}nd`;
  if (pos === 23 || pos === 33) return `${pos}rd`;
  return `${pos}th`;
}

function shortTeamName(name: string) {
  return String(name || "").split(" ").slice(0, 2).join(" ");
}

export default function HeroMatch({
  activeGame,
  gamesSorted,
  allGames,
  activeIndex,
  setActiveIndex,
  setUserPinnedSelection,
  upcomingGames,
  showAllFixtureTabs,
  setShowAllFixtureTabs,
  now,
  weather,
  isActiveUpcoming,
  onToast,
  ladder,
}: {
  activeGame: Game;
  gamesSorted: Game[];
  allGames: Game[];
  activeIndex: number;
  setActiveIndex: (value: number) => void;
  setUserPinnedSelection: (value: boolean) => void;
  upcomingGames: Game[];
  showAllFixtureTabs: boolean;
  setShowAllFixtureTabs: (value: boolean) => void;
  now: Date;
  weather: Weather | null;
  isActiveUpcoming: boolean;
  onToast?: (msg: string) => void;
  ladder?: LadderPayload;
}) {
  const homePos = getTeamPosition(ladder, activeGame.home);
  const awayPos = getTeamPosition(ladder, activeGame.away);

  const visibleTabs = showAllFixtureTabs ? gamesSorted : gamesSorted.slice(0, 6);

  const hasPastGames = gamesSorted.some(
    (g) => new Date(g.kickoffISO).getTime() < now.getTime()
  );

  return (
    <section className={`${styles.card} ${styles.heroCard}`}>
      <div className={styles.cardPad}>
        <div className={styles.heroTop}>
          <div className={styles.heroLabels}>
            <span className={`${styles.pill} ${styles.pillGold}`}>
              {isActiveUpcoming ? "Next game" : "Latest result"}
            </span>

            <span className={`${styles.pill} ${styles.pillBlue}`}>
              {formatDayDateFromSource(activeGame.date)}
            </span>

            <span className={`${styles.pill} ${styles.pillSoft}`}>
              {formatTimeFromSource(activeGame.time)}
            </span>
          </div>

          <div className={styles.heroNav}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSoft}`}
              onClick={() => {
                const next = Math.max(activeIndex - 1, 0);
                setActiveIndex(next);
                setUserPinnedSelection(true);
              }}
              disabled={activeIndex <= 0}
            >
              Prev
            </button>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnSoft}`}
              onClick={() => {
                const next = Math.min(activeIndex + 1, gamesSorted.length - 1);
                setActiveIndex(next);
                setUserPinnedSelection(true);
              }}
              disabled={activeIndex >= gamesSorted.length - 1}
            >
              Next
            </button>
          </div>
        </div>

        <div className={styles.fixtureTabsWrap}>
          <div className={styles.fixtureTabs}>
            {visibleTabs.map((game, idx) => {
              const originalIndex = gamesSorted.findIndex(
                (g) => g.kickoffISO === game.kickoffISO && g.home === game.home && g.away === game.away
              );

              const isActive = originalIndex === activeIndex;

              return (
                <button
                  key={`${game.kickoffISO}-${game.home}-${game.away}`}
                  type="button"
                  className={`${styles.fixtureTab} ${isActive ? styles.fixtureTabActive : ""}`}
                  onClick={() => {
                    setActiveIndex(originalIndex);
                    setUserPinnedSelection(true);
                  }}
                >
                  <span className={styles.fixtureTabTop}>
                    {formatDayDateFromSource(game.date)}
                  </span>
                  <span className={styles.fixtureTabBottom}>
                    {shortTeamName(game.home)} v {shortTeamName(game.away)}
                  </span>
                </button>
              );
            })}

            {gamesSorted.length > 6 ? (
              <button
                type="button"
                className={styles.fixtureMore}
                onClick={() => setShowAllFixtureTabs(!showAllFixtureTabs)}
              >
                {showAllFixtureTabs ? "Show less" : `Show all (${gamesSorted.length})`}
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.matchStack}>
          <div className={styles.matchTeamRow}>
            <div className={styles.logo}>
              <div className={styles.logoFallback}>H</div>
            </div>

            <div className={styles.matchTeamText}>
              <div className={styles.teamNameLg}>
                {activeGame.home}
                {homePos ? (
                  <span className={styles.teamPosPill}>{positionLabel(homePos)}</span>
                ) : null}
              </div>
              <div className={styles.teamSub}>Home</div>
            </div>
          </div>

          <div className={styles.matchVs}>VS</div>

          <div className={styles.resultPill}>
            {activeGame.score && activeGame.score !== "-" ? activeGame.score : "vs"}
          </div>

          <div className={styles.matchTeamRow}>
            <div className={styles.logo}>
              <div className={styles.logoFallback}>A</div>
            </div>

            <div className={styles.matchTeamText}>
              <div className={styles.teamNameLg}>
                {activeGame.away}
                {awayPos ? (
                  <span className={styles.teamPosPill}>{positionLabel(awayPos)}</span>
                ) : null}
              </div>
              <div className={styles.teamSub}>Away</div>
            </div>
          </div>
        </div>

        <div className={styles.metaStrip}>
          <div className={styles.metaItem}>{formatLongDateFromSource(activeGame.date)}</div>
          <div className={styles.metaItem}>{formatTimeFromSource(activeGame.time)}</div>
          <div className={styles.metaItem}>{activeGame.venue || "TBC"}</div>
          {activeGame.roundLabel ? (
            <div className={styles.metaItem}>{activeGame.roundLabel}</div>
          ) : null}
        </div>

        {weather?.ok && isActiveUpcoming ? (
          <div className={styles.weatherRow}>
            {typeof weather.tempC === "number" ? (
              <span className={styles.pill}>{weather.tempC}°C</span>
            ) : null}
            {typeof weather.precipMM === "number" ? (
              <span className={styles.pill}>{weather.precipMM}mm rain</span>
            ) : null}
            {typeof weather.windKmh === "number" ? (
              <span className={styles.pill}>{weather.windKmh}km/h wind</span>
            ) : null}
          </div>
        ) : null}

        <div className={styles.heroSection}>
          <AvailabilityBlock game={activeGame} onToast={onToast} />
        </div>
      </div>

      <div className={styles.cardPad}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Upcoming fixtures</h2>

          <div className={styles.upcomingList}>
            {upcomingGames.length ? (
              upcomingGames.slice(0, 6).map((game) => {
                const isActive =
                  game.kickoffISO === activeGame.kickoffISO &&
                  game.home === activeGame.home &&
                  game.away === activeGame.away;

                const idx = gamesSorted.findIndex(
                  (g) =>
                    g.kickoffISO === game.kickoffISO &&
                    g.home === game.home &&
                    g.away === game.away
                );

                return (
                  <button
                    key={`${game.kickoffISO}-${game.home}-${game.away}-row`}
                    type="button"
                    className={`${styles.fixtureRow} ${isActive ? styles.fixtureRowActive : ""}`}
                    onClick={() => {
                      setActiveIndex(idx);
                      setUserPinnedSelection(true);
                    }}
                  >
                    <div>
                      <div className={styles.fixtureRowTitle}>
                        {game.home} vs {game.away}
                      </div>
                      <div className={styles.fixtureRowSub}>
                        {formatDayDateFromSource(game.date)} • {formatTimeFromSource(game.time)} •{" "}
                        {game.venue}
                      </div>
                    </div>

                    <div className={styles.fixtureRowSide}>
                      <div className={styles.fixtureMiniStatus}>
                        <span>{isActive ? "Viewing now" : "Tap to view"}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={styles.hint}>
                {hasPastGames ? "No future games loaded yet." : "No fixtures available."}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
