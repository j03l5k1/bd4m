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
  formatLongDateFromSource,
  formatTimeFromSource,
  parseScore,
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

type TeamRecentResult = {
  game: Game;
  opponent: string;
  gf: number;
  ga: number;
  result: "W" | "L" | "D";
};

function getTeamRecentResults(allGames: Game[], teamName: string, limit = 5): TeamRecentResult[] {
  return allGames
    .map((game) => {
      const score = parseScore(game.score);
      if (!score) return null;

      const isHome = game.home === teamName;
      const isAway = game.away === teamName;
      if (!isHome && !isAway) return null;

      const gf = isHome ? score.a : score.b;
      const ga = isHome ? score.b : score.a;
      const opponent = isHome ? game.away : game.home;
      const result: "W" | "L" | "D" = gf > ga ? "W" : gf < ga ? "L" : "D";

      return { game, opponent, gf, ga, result };
    })
    .filter((item): item is TeamRecentResult => Boolean(item))
    .sort(
      (a, b) =>
        new Date(b.game.kickoffISO).getTime() - new Date(a.game.kickoffISO).getTime()
    )
    .slice(0, limit);
}

function getStreakLabel(results: TeamRecentResult[]) {
  if (!results.length) return "No streak";
  const first = results[0].result;
  let count = 1;
  for (let i = 1; i < results.length; i += 1) {
    if (results[i].result !== first) break;
    count += 1;
  }
  const map = { W: "Won", L: "Lost", D: "Drew" } as const;
  return `${map[first]} ${count}`;
}

function getFormString(results: TeamRecentResult[], length = 4) {
  if (!results.length) return "Form unavailable";
  return results
    .slice(0, length)
    .map((r) => r.result)
    .join("");
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

  const visibleTabs = showAllFixtureTabs ? gamesSorted : gamesSorted.slice(0, 6);
  const roundLabel = activeGame.roundLabel?.trim() || `Round ${activeIndex + 1}`;
  const homeRecent = getTeamRecentResults(allGames, activeGame.home, 5);
  const awayRecent = getTeamRecentResults(allGames, activeGame.away, 5);
  const homeForm = getFormString(homeRecent, 4);
  const awayForm = getFormString(awayRecent, 4);
  const homeRecentGF = homeRecent.reduce((sum, r) => sum + r.gf, 0);
  const homeRecentGA = homeRecent.reduce((sum, r) => sum + r.ga, 0);
  const awayRecentGF = awayRecent.reduce((sum, r) => sum + r.gf, 0);
  const awayRecentGA = awayRecent.reduce((sum, r) => sum + r.ga, 0);

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

          <div className={styles.roundHeroWrap}>
            <span className={`${ui.pill} ${ui.pillGold} ${styles.roundHeroPill}`}>
              {roundLabel}
            </span>
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
                  {activeGame.venue || "TBC"}
                </div>
                {isActiveUpcoming ? (
                  <details className={styles.matchWeatherDetails}>
                    <summary className={styles.matchWeatherSummary}>
                      <WeatherIcon size={13} />
                      <span>{weatherLoading ? "Weather loading..." : `${weatherVisualInfo.label} ${weatherMiniText}`}</span>
                    </summary>
                    <div className={styles.matchWeatherBody}>
                      <div>{weatherBadgeText}</div>
                      <div>Location: {weather?.location || "Homebush NSW, Australia"}</div>
                      <div>Forecast time: {weatherAt || "Match kickoff hour"}</div>
                    </div>
                  </details>
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
                <span>Form guide</span>
                <span className={`${ui.summaryRight} ${styles.formSummaryRight}`}>
                  <span>{homeMeta.shortName}: {homeForm}</span>
                  <span>{awayMeta.shortName}: {awayForm}</span>
                </span>
              </summary>
              <div className={ui.detailsBody}>
                <div className={styles.formGuideGrid}>
                  <div className={styles.formTeamCard}>
                    <div className={styles.formTeamHeader}>
                      <span className={styles.formTeamName}>{homeMeta.shortName}</span>
                      <span className={styles.formStreak}>{getStreakLabel(homeRecent)}</span>
                    </div>
                    {homeRecent.length ? (
                      <>
                        <div className={styles.formChipRow}>
                          {homeRecent.map((r, idx) => (
                            <span
                              key={`${homeMeta.shortName}-${idx}-${r.game.kickoffISO}`}
                              className={`${styles.formChip} ${
                                r.result === "W"
                                  ? styles.formChipWin
                                  : r.result === "L"
                                    ? styles.formChipLoss
                                    : styles.formChipDraw
                              }`}
                            >
                              {r.result}
                            </span>
                          ))}
                        </div>
                        <div className={styles.formStatsRow}>
                          <span>GF {homeRecentGF}</span>
                          <span>GA {homeRecentGA}</span>
                        </div>
                        <div className={styles.formResultsList}>
                          {homeRecent.map((r, idx) => (
                            <div key={`${homeMeta.shortName}-game-${idx}-${r.game.kickoffISO}`} className={styles.formResultRow}>
                              <span>vs {getTeamMeta(r.opponent).shortName}</span>
                              <span className={styles.formResultScore}>{r.gf}-{r.ga}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className={styles.hint}>Form unavailable</div>
                    )}
                  </div>

                  <div className={styles.formTeamCard}>
                    <div className={styles.formTeamHeader}>
                      <span className={styles.formTeamName}>{awayMeta.shortName}</span>
                      <span className={styles.formStreak}>{getStreakLabel(awayRecent)}</span>
                    </div>
                    {awayRecent.length ? (
                      <>
                        <div className={styles.formChipRow}>
                          {awayRecent.map((r, idx) => (
                            <span
                              key={`${awayMeta.shortName}-${idx}-${r.game.kickoffISO}`}
                              className={`${styles.formChip} ${
                                r.result === "W"
                                  ? styles.formChipWin
                                  : r.result === "L"
                                    ? styles.formChipLoss
                                    : styles.formChipDraw
                              }`}
                            >
                              {r.result}
                            </span>
                          ))}
                        </div>
                        <div className={styles.formStatsRow}>
                          <span>GF {awayRecentGF}</span>
                          <span>GA {awayRecentGA}</span>
                        </div>
                        <div className={styles.formResultsList}>
                          {awayRecent.map((r, idx) => (
                            <div key={`${awayMeta.shortName}-game-${idx}-${r.game.kickoffISO}`} className={styles.formResultRow}>
                              <span>vs {getTeamMeta(r.opponent).shortName}</span>
                              <span className={styles.formResultScore}>{r.gf}-{r.ga}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className={styles.hint}>Form unavailable</div>
                    )}
                  </div>
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
