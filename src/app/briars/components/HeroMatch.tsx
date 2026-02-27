"use client";

import ui from "../briars.module.css";
import styles from "../hero.module.css";
import AvailabilityBlock from "./AvailabilityBlock";
import HeadToHead from "./HeadToHead";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudSun,
  Droplets,
  MapPin,
  Wind,
} from "lucide-react";

import {
  formatDayDateFromSource,
  formatLongDateFromSource,
  formatTimeFromSource,
} from "../../../lib/briars/format";
import { getTeamMeta } from "../../../lib/briars/teamMeta";
import type { Game, LadderPayload, Weather } from "../../../lib/briars/types";

function getTeamPosition(ladder: LadderPayload | undefined, teamName: string) {
  if (!ladder?.rows?.length) return null;
  const idx = ladder.rows.findIndex((r) => r.team === teamName);
  if (idx === -1) return null;
  return idx + 1;
}

function ordinal(pos: number | null) {
  if (!pos) return null;
  if (pos % 10 === 1 && pos % 100 !== 11) return `${pos}st`;
  if (pos % 10 === 2 && pos % 100 !== 12) return `${pos}nd`;
  if (pos % 10 === 3 && pos % 100 !== 13) return `${pos}rd`;
  return `${pos}th`;
}

function TeamLogo({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const meta = getTeamMeta(name);
  const fallback = meta.shortName.slice(0, 1).toUpperCase();

  if (meta.logoUrl) {
    return (
      <div className={`${styles.teamLogoWrap} ${className || ""}`}>
        <img
          src={meta.logoUrl}
          alt={meta.shortName}
          className={styles.teamLogo}
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = "none";
            const parent = img.parentElement;
            if (parent) parent.setAttribute("data-fallback", fallback);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.teamLogoWrap} ${className || ""}`} data-fallback={fallback}>
      <span className={styles.teamLogoFallback}>{fallback}</span>
    </div>
  );
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

  const homeMeta = getTeamMeta(activeGame.home);
  const awayMeta = getTeamMeta(activeGame.away);

  const visibleTabs = showAllFixtureTabs ? gamesSorted : gamesSorted.slice(0, 6);
  const roundNumber = activeIndex + 1;
  const roundLabel = `Round ${roundNumber}`;

  return (
    <>
      <section className={`${ui.card} ${styles.heroCard}`}>
        <div className={ui.cardPad}>
          <div className={styles.topStrip}>
            <div className={styles.topBadges}>
              <span className={`${ui.pill} ${ui.pillGold}`}>
                {isActiveUpcoming ? "Next game" : "Latest result"}
              </span>
              <span className={`${ui.pill} ${ui.pillBlue}`}>{formatDayDateFromSource(activeGame.date)}</span>
              <span className={ui.pill}>{formatTimeFromSource(activeGame.time)}</span>
              <span className={`${ui.pill} ${ui.pillSoft}`}>{roundLabel}</span>
            </div>
          </div>

          <div className={styles.navRow}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSoft} ${styles.navBtn}`}
              onClick={() => {
                const next = Math.max(activeIndex - 1, 0);
                setActiveIndex(next);
                setUserPinnedSelection(true);
              }}
              disabled={activeIndex <= 0}
            >
              <ChevronLeft size={18} />
              Prev
            </button>

            <div className={styles.navCenter}>
              <div className={styles.roundEyebrow}>Viewing</div>
              <div className={styles.roundValue}>{roundLabel}</div>
            </div>

            <button
              type="button"
              className={`${ui.btn} ${ui.btnSoft} ${styles.navBtn}`}
              onClick={() => {
                const next = Math.min(activeIndex + 1, gamesSorted.length - 1);
                setActiveIndex(next);
                setUserPinnedSelection(true);
              }}
              disabled={activeIndex >= gamesSorted.length - 1}
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>

          <div className={styles.fixtureTabsWrap}>
            <div className={styles.fixtureTabs}>
              {visibleTabs.map((game, idx) => {
                const originalIndex = gamesSorted.findIndex(
                  (g) =>
                    g.kickoffISO === game.kickoffISO &&
                    g.home === game.home &&
                    g.away === game.away
                );

                const isActive = originalIndex === activeIndex;
                const home = getTeamMeta(game.home).shortName;
                const away = getTeamMeta(game.away).shortName;

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
                    <span className={styles.fixtureTabTop}>Rnd {originalIndex + 1}</span>
                    <span className={styles.fixtureTabBottom}>
                      {home} v {away}
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

          <div className={styles.heroShowcase}>
            <div className={styles.teamSide}>
              <TeamLogo name={activeGame.home} />
              <div className={styles.teamName}>
                {homeMeta.shortName}
                {homePos ? <span className={styles.rankPill}>({ordinal(homePos)})</span> : null}
              </div>
            </div>

            <div className={styles.vsColumn}>
              <div className={styles.vsWord}>VS</div>
              <div className={styles.vsPill}>
                {activeGame.score && activeGame.score !== "-" ? activeGame.score : "Matchup"}
              </div>
            </div>

            <div className={styles.teamSide}>
              <TeamLogo name={activeGame.away} />
              <div className={styles.teamName}>
                {awayMeta.shortName}
                {awayPos ? <span className={styles.rankPill}>({ordinal(awayPos)})</span> : null}
              </div>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <CalendarDays size={18} />
              <span>{formatLongDateFromSource(activeGame.date)}</span>
            </div>

            <div className={styles.infoCard}>
              <Clock3 size={18} />
              <span>{formatTimeFromSource(activeGame.time)}</span>
            </div>

            <div className={styles.infoCard}>
              <MapPin size={18} />
              <span>{activeGame.venue || "TBC"}</span>
            </div>

            <div className={styles.infoCard}>
              <span className={styles.infoRoundBadge}>{roundLabel}</span>
            </div>
          </div>

          {weather?.ok && isActiveUpcoming ? (
            <div className={styles.weatherGrid}>
              {typeof weather.tempC === "number" ? (
                <div className={styles.weatherCard}>
                  <CloudSun size={17} />
                  <span>{weather.tempC}°C</span>
                </div>
              ) : null}

              {typeof weather.precipMM === "number" ? (
                <div className={styles.weatherCard}>
                  <Droplets size={17} />
                  <span>{weather.precipMM}mm</span>
                </div>
              ) : null}

              {typeof weather.windKmh === "number" ? (
                <div className={styles.weatherCard}>
                  <Wind size={17} />
                  <span>{weather.windKmh}km/h</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={styles.heroSection}>
            <AvailabilityBlock game={activeGame} onToast={onToast} />
          </div>
        </div>

        <div className={ui.cardPad}>
          <section className={ui.section}>
            <h2 className={ui.sectionTitle}>Upcoming fixtures</h2>

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

                  const home = getTeamMeta(game.home).shortName;
                  const away = getTeamMeta(game.away).shortName;

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
                          Rnd {idx + 1} • {home} v {away}
                        </div>
                        <div className={styles.fixtureRowSub}>
                          {formatDayDateFromSource(game.date)} • {formatTimeFromSource(game.time)} • {game.venue}
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
                <div className={styles.hint}>No future games loaded yet.</div>
              )}
            </div>
          </section>
        </div>
      </section>

      <HeadToHead activeGame={activeGame} allGames={allGames} />
    </>
  );
}
