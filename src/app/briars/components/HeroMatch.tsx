"use client";

import { useEffect, useRef, useState } from "react";
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
  FiMinus,
  FiSun,
  FiZap,
} from "react-icons/fi";

import {
  buildRoundMap,
  formatLongDateFromSource,
  formatTimeFromSource,
  parseScore,
} from "../../../lib/briars/format";
import { getTeamMeta } from "../../../lib/briars/teamMeta";
import type { Game, LadderPayload, Weather } from "../../../lib/briars/types";

function getTeamPosition(ladder: LadderPayload | undefined, teamName: string) {
  if (!ladder?.rows?.length) return null;
  // Sort same way as LadderTable: points DESC, GD DESC as tiebreaker
  // cols[8] = Pts, cols[7] = GD (from the normalised EXPECTED_HEADERS order in the API)
  const sorted = [...ladder.rows].sort((a, b) => {
    const ptsDiff = (Number(b.cols[8]) || 0) - (Number(a.cols[8]) || 0);
    if (ptsDiff !== 0) return ptsDiff;
    return (Number(b.cols[7]) || 0) - (Number(a.cols[7]) || 0);
  });
  const idx = sorted.findIndex((r) => r.team === teamName);
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

  if (code === null) {
    if (precip > 0) return { icon: FiCloudRain, label: "Rain likely" };
    return { icon: FiMinus, label: "No forecast" };
  }

  if (code === 0)  return { icon: FiSun,          label: "Clear skies" };
  if (code === 1)  return { icon: FiSun,          label: "Mainly clear" };
  if (code === 2)  return { icon: FiCloud,         label: "Partly cloudy" };
  if (code === 3)  return { icon: FiCloud,         label: "Overcast" };
  if (code === 45 || code === 48) return { icon: FiCloud, label: "Foggy" };
  if (code === 51) return { icon: FiCloudDrizzle,  label: "Light drizzle" };
  if (code === 53) return { icon: FiCloudDrizzle,  label: "Drizzle" };
  if (code === 55) return { icon: FiCloudDrizzle,  label: "Heavy drizzle" };
  if (code === 56 || code === 57) return { icon: FiCloudDrizzle, label: "Freezing drizzle" };
  if (code === 61) return { icon: FiCloudRain,     label: "Light rain" };
  if (code === 63) return { icon: FiCloudRain,     label: "Moderate rain" };
  if (code === 65) return { icon: FiCloudRain,     label: "Heavy rain" };
  if (code === 66 || code === 67) return { icon: FiCloudRain, label: "Freezing rain" };
  if (code === 71) return { icon: FiCloudSnow,     label: "Light snow" };
  if (code === 73) return { icon: FiCloudSnow,     label: "Snow" };
  if (code === 75) return { icon: FiCloudSnow,     label: "Heavy snow" };
  if (code === 77) return { icon: FiCloudSnow,     label: "Snow grains" };
  if (code === 80) return { icon: FiCloudRain,     label: "Light showers" };
  if (code === 81) return { icon: FiCloudRain,     label: "Showers" };
  if (code === 82) return { icon: FiCloudRain,     label: "Heavy showers" };
  if (code === 85) return { icon: FiCloudSnow,     label: "Snow showers" };
  if (code === 86) return { icon: FiCloudSnow,     label: "Heavy snow showers" };
  if (code === 95) return { icon: FiZap,           label: "Thunderstorm" };
  if (code === 96) return { icon: FiZap,           label: "Storm with hail" };
  if (code === 99) return { icon: FiZap,           label: "Violent storm" };
  return { icon: FiMinus, label: "No forecast" };
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
  roundDisplay: string;
};


function getTeamRecentResults(allGames: Game[], teamName: string, limit = 5): TeamRecentResult[] {
  const roundMap = buildRoundMap(allGames);

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
      const rnd = roundMap.get(game.kickoffISO.slice(0, 10));
      const roundDisplay = rnd !== undefined ? `Rd ${rnd}` : "–";

      return { game, opponent, gf, ga, result, roundDisplay };
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


function formatCountdown(kickoffISO: string): string {
  const diff = new Date(kickoffISO).getTime() - Date.now();
  if (diff <= 0) return "Kickoff!";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
  weather,
  weatherLoading,
  isActiveUpcoming,
  onToast,
  ladder,
  nextUpcomingIndex,
}: {
  activeGame: Game;
  gamesSorted: Game[];
  allGames: Game[];
  activeIndex: number;
  setActiveIndex: (value: number) => void;
  setUserPinnedSelection: (value: boolean) => void;
  weather: Weather | null;
  weatherLoading: boolean;
  isActiveUpcoming: boolean;
  onToast?: (msg: string) => void;
  ladder?: LadderPayload;
  nextUpcomingIndex: number;
}) {
  const homePos = getTeamPosition(ladder, activeGame.home);
  const awayPos = getTeamPosition(ladder, activeGame.away);

  const homeMeta = getTeamMeta(activeGame.home);
  const awayMeta = getTeamMeta(activeGame.away);
  const [availabilityHint, setAvailabilityHint] = useState("Tap to expand");
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!isActiveUpcoming) { setCountdown(null); return; }
    const update = () => setCountdown(formatCountdown(activeGame.kickoffISO));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [isActiveUpcoming, activeGame.kickoffISO]);

  const activeTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex]);

  const roundLabel = activeGame.roundLabel?.trim() || `Round ${activeIndex + 1}`;
  const homeRecent = getTeamRecentResults(allGames, activeGame.home, 5);
  const awayRecent = getTeamRecentResults(allGames, activeGame.away, 5);
  const homeForm = getFormString(homeRecent, 4);
  const awayForm = getFormString(awayRecent, 4);

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
              {gamesSorted.map((game) => {
                const originalIndex = gamesSorted.findIndex(
                  (g) =>
                    g.kickoffISO === game.kickoffISO &&
                    g.home === game.home &&
                    g.away === game.away
                );

                const isActive = originalIndex === activeIndex;
                const isNext = originalIndex === nextUpcomingIndex;
                const isPlayed = !!parseScore(game.score);
                const home = getTeamMeta(game.home).shortName;
                const away = getTeamMeta(game.away).shortName;

                return (
                  <button
                    key={`${game.kickoffISO}-${game.home}-${game.away}`}
                    ref={isActive ? activeTabRef : undefined}
                    type="button"
                    className={`${styles.fixtureTab} ${isActive ? styles.fixtureTabActive : ""} ${!isActive && isPlayed ? styles.fixtureTabPlayed : ""}`}
                    onClick={() => {
                      setActiveIndex(originalIndex);
                      setUserPinnedSelection(true);
                    }}
                  >
                    <span className={styles.fixtureTabTopRow}>
                      <span className={styles.fixtureTabTop}>Rnd {originalIndex + 1}</span>
                      {isNext && <span className={styles.fixtureTabNextPill}>Next game</span>}
                    </span>
                    <span className={styles.fixtureTabBottom}>
                      {home} v {away}
                    </span>
                  </button>
                );
              })}

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
              <div className={styles.teamName}>{homeMeta.shortName}</div>
              {homePos ? <span className={styles.rankPill}>{ordinal(homePos)}</span> : null}
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
                {countdown ? (
                  <div className={styles.countdownLine}>
                    Starts in: <span className={styles.countdownValue}>{countdown}</span>
                  </div>
                ) : null}
                {isActiveUpcoming && activeIndex === nextUpcomingIndex ? (
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
              <div className={styles.teamName}>{awayMeta.shortName}</div>
              {awayPos ? <span className={styles.rankPill}>{ordinal(awayPos)}</span> : null}
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
                      <div className={styles.formChipGrid}>
                        {[...homeRecent].reverse().map((r, idx) => (
                          <div key={`${homeMeta.shortName}-${idx}-${r.game.kickoffISO}`} className={styles.formChipCol}>
                            <span className={styles.formChipRound}>{r.roundDisplay}</span>
                            <span className={styles.formChipOpp}>vs {getTeamMeta(r.opponent).shortName}</span>
                            <span
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
                            <span className={styles.formChipScore}>{r.gf}-{r.ga}</span>
                          </div>
                        ))}
                      </div>
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
                      <div className={styles.formChipGrid}>
                        {[...awayRecent].reverse().map((r, idx) => (
                          <div key={`${awayMeta.shortName}-${idx}-${r.game.kickoffISO}`} className={styles.formChipCol}>
                            <span className={styles.formChipRound}>{r.roundDisplay}</span>
                            <span className={styles.formChipOpp}>vs {getTeamMeta(r.opponent).shortName}</span>
                            <span
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
                            <span className={styles.formChipScore}>{r.gf}-{r.ga}</span>
                          </div>
                        ))}
                      </div>
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
