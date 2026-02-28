"use client";

import { useEffect, useState } from "react";
import ui from "../briars.module.css";
import styles from "../hero.module.css";
import AvailabilityBlock from "./AvailabilityBlock";
import HeadToHead from "./HeadToHead";

import {
  FiChevronLeft,
  FiChevronRight,
  FiCloud,
  FiCloudDrizzle,
  FiCloudRain,
  FiCloudSnow,
  FiSun,
  FiZap,
} from "react-icons/fi";

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

function weatherVisual(weather: Weather | null) {
  const code = typeof weather?.weatherCode === "number" ? weather.weatherCode : null;
  const precip = typeof weather?.precipMM === "number" ? weather.precipMM : 0;

  if (code === 0) return { icon: FiSun, label: "Sunny" };
  if (code === 1 || code === 2) return { icon: FiCloud, label: "Partly cloudy" };
  if (code === 3 || code === 45 || code === 48) return { icon: FiCloud, label: "Cloudy" };
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) {
    return { icon: FiCloudDrizzle, label: "Drizzle" };
  }
  if (
    code === 61 || code === 63 || code === 65 || code === 66 || code === 67 ||
    code === 80 || code === 81 || code === 82
  ) {
    return { icon: FiCloudRain, label: "Rain" };
  }
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
    return { icon: FiCloudSnow, label: "Snow" };
  }
  if (code === 95 || code === 96 || code === 99) return { icon: FiZap, label: "Storm" };
  if (precip > 0) return { icon: FiCloudRain, label: "Rain" };
  return { icon: FiCloud, label: "Cloudy" };
}

function formatWeatherAt(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoFailed(false);
  }, [name, meta.logoUrl]);

  const showImage = Boolean(meta.logoUrl) && !logoFailed;

  return (
    <div className={`${styles.teamLogoWrap} ${className || ""}`}>
      {showImage ? (
        <img
          src={meta.logoUrl}
          alt={meta.shortName}
          className={styles.teamLogo}
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className={styles.teamLogoFallback}>{fallback}</span>
      )}
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
  weatherLoading,
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
  weather: Weather | null;
  weatherLoading: boolean;
  isActiveUpcoming: boolean;
  onToast?: (msg: string) => void;
  ladder?: LadderPayload;
}) {
  const homePos = getTeamPosition(ladder, activeGame.home);
  const awayPos = getTeamPosition(ladder, activeGame.away);

  const homeMeta = getTeamMeta(activeGame.home);
  const awayMeta = getTeamMeta(activeGame.away);
  const [availabilityHint, setAvailabilityHint] = useState("Tap to expand");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const visibleTabs = showAllFixtureTabs ? gamesSorted : gamesSorted.slice(0, 6);
  const roundLabel = activeGame.roundLabel?.trim() || `Round ${activeIndex + 1}`;

  const weatherBits = [
    typeof weather?.tempC === "number" ? `${weather.tempC}°C` : null,
    typeof weather?.precipMM === "number" ? `${weather.precipMM}mm` : null,
    typeof weather?.windKmh === "number" ? `${weather.windKmh}km/h` : null,
  ].filter(Boolean) as string[];
  const weatherSummary = weatherBits.length ? weatherBits.join(" • ") : null;
  const weatherVisualInfo = weatherVisual(weather);
  const WeatherIcon = weatherVisualInfo.icon;
  const weatherBadgeText = !isActiveUpcoming
    ? "Weather n/a"
    : weatherLoading
      ? "Weather loading..."
      : weatherSummary || "Weather unavailable";
  const weatherMiniText =
    isActiveUpcoming && !weatherLoading && typeof weather?.tempC === "number"
      ? `${Math.round(weather.tempC)}°C`
      : weatherLoading
        ? "..."
        : "n/a";
  const weatherAt = formatWeatherAt(weather?.at);

  return (
    <>
      <section className={`${ui.card} ${styles.heroCard}`}>
        <div className={ui.cardPad}>
          <div className={styles.topStrip}>
            <div className={styles.topBadges}>
              <span className={`${ui.pill} ${ui.pillGold}`}>
                {roundLabel}
              </span>
              <span className={`${ui.pill} ${ui.pillBlue}`}>{formatDayDateFromSource(activeGame.date)}</span>
              <span className={ui.pill}>{formatTimeFromSource(activeGame.time)}</span>
              {isActiveUpcoming ? (
                <details className={styles.weatherDetails}>
                  <summary className={styles.weatherSummary}>
                    <span className={styles.weatherSummaryLeft}>
                      <WeatherIcon size={14} />
                      {weatherVisualInfo.label}
                    </span>
                    <span className={styles.weatherSummaryTemp}>{weatherMiniText}</span>
                  </summary>
                  <div className={styles.weatherBody}>
                    <div>{weatherBadgeText}</div>
                    <div>Location: {weather?.location || "Homebush NSW, Australia"}</div>
                    <div>Forecast time: {weatherAt || "Match kickoff hour"}</div>
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div className={styles.fixtureTabsWrap}>
            <div className={styles.fixtureTabs}>
              {visibleTabs.map((game) => {
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
              <div className={styles.matchupControls}>
                <button
                  type="button"
                  className={`${styles.matchNavBtn} ${styles.matchNavBtnPrimary}`}
                  onClick={() => {
                    const next = Math.max(activeIndex - 1, 0);
                    setActiveIndex(next);
                    setUserPinnedSelection(true);
                  }}
                  disabled={activeIndex <= 0}
                  aria-label="Previous matchup"
                >
                  <FiChevronLeft size={17} />
                </button>
                <div className={styles.vsPill}>
                  {activeGame.score && activeGame.score !== "-" ? activeGame.score : "Matchup"}
                </div>
                <button
                  type="button"
                  className={`${styles.matchNavBtn} ${styles.matchNavBtnPrimary}`}
                  onClick={() => {
                    const next = Math.min(activeIndex + 1, gamesSorted.length - 1);
                    setActiveIndex(next);
                    setUserPinnedSelection(true);
                  }}
                  disabled={activeIndex >= gamesSorted.length - 1}
                  aria-label="Next matchup"
                >
                  <FiChevronRight size={17} />
                </button>
              </div>
              <div className={styles.vsWord}>VS</div>

              <div className={styles.matchMeta}>
                <div className={styles.matchMetaLine}>
                  {formatLongDateFromSource(activeGame.date)} • {formatTimeFromSource(activeGame.time)}
                </div>
                <div className={styles.matchMetaLine}>
                  {activeGame.venue || "TBC"} • {roundLabel}
                </div>
                {isActiveUpcoming ? (
                  <div className={styles.matchMetaSub}>{weatherLoading ? "Weather loading..." : weatherSummary || "Weather unavailable"}</div>
                ) : null}
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

          <div className={styles.heroSection}>
            <details className={`${ui.details} ${styles.collapseBlock}`}>
              <summary className={ui.summary}>
                <span>Availability</span>
                <span className={ui.summaryRight}>{availabilityHint}</span>
              </summary>
              <div className={ui.detailsBody}>
                <AvailabilityBlock
                  game={activeGame}
                  onToast={onToast}
                  onStatusHintChange={setAvailabilityHint}
                />
              </div>
            </details>
          </div>
        </div>

        <div className={ui.cardPad}>
          <section className={ui.section}>
            <details className={`${ui.details} ${styles.collapseBlock}`}>
              <summary className={ui.summary}>
                <span>Upcoming fixtures</span>
                <span className={ui.summaryRight}>
                  {upcomingGames.length ? `${Math.min(upcomingGames.length, 2)} shown` : "Tap to expand"}
                </span>
              </summary>
              <div className={ui.detailsBody}>
                <div className={styles.upcomingList}>
                  {upcomingGames.length ? (
                    upcomingGames.slice(0, showAllUpcoming ? 6 : 2).map((game) => {
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

                  {upcomingGames.length > 2 ? (
                    <button
                      type="button"
                      className={styles.upcomingMoreBtn}
                      onClick={() => setShowAllUpcoming((prev) => !prev)}
                    >
                      {showAllUpcoming ? "Show fewer" : `View all (${Math.min(upcomingGames.length, 6)})`}
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          </section>
        </div>
      </section>

      <HeadToHead activeGame={activeGame} allGames={allGames} />
    </>
  );
}
