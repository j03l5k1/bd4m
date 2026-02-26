"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, CloudSun, Droplets, MapPin, Wind } from "lucide-react";
import styles from "../briars.module.css";
import AvailabilityBlock from "./AvailabilityBlock";
import type { Game, Weather, LadderPayload } from "../page";
import HeadToHead from "./HeadToHead";

const CLUB_LOGOS: Record<string, string> = {
  briars: "https://smhockey.com.au/wireframe/assets/images/briars_logo.jpg",
  macarthur: "https://smhockey.com.au/wireframe/assets/images/mac_logo.png",
  macquarie: "https://smhockey.com.au/wireframe/assets/images/mac_uni.png",
  manly: "https://smhockey.com.au/wireframe/assets/images/manly_logo.jpg",
  penrith: "https://smhockey.com.au/wireframe/assets/images/penrith_logo.jpg",
  ryde: "https://smhockey.com.au/wireframe/assets/images/ryde_logo.png",
};

function clubKey(teamName: string) {
  const s = teamName.toLowerCase();
  if (s.includes("briars")) return "briars";
  if (s.includes("macarthur")) return "macarthur";
  if (s.includes("macquarie")) return "macquarie";
  if (s.includes("manly") || s.includes("gns")) return "manly";
  if (s.includes("penrith")) return "penrith";
  if (s.includes("ryde")) return "ryde";
  return "";
}

function makeSourceKey(g: Game) {
  return `${g.date}|${g.time}|${g.home}|${g.away}|${g.venue}`;
}

function parseSourceDate(dateStr: string) {
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1);
}
function formatDayDateFromSource(dateStr: string) {
  const d = parseSourceDate(dateStr);
  const day = d.toLocaleDateString("en-AU", { weekday: "short" });
  const [dd, mm] = dateStr.split("/");
  return `${day} ${dd}/${mm}`;
}
function formatLongDateFromSource(dateStr: string) {
  const d = parseSourceDate(dateStr);
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function formatTimeFromSource(timeStr: string) {
  const [hour24 = 0, minute = 0] = timeStr.split(":").map(Number);
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}
function shortTeamName(team: string) {
  return team.trim().split(/\s+/)[0] || team;
}
function formatCountdown(ms: number) {
  if (ms <= 0) return "Started";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  return `${days}d ${hours}h ${mins}m`;
}

function Logo({ url }: { url?: string }) {
  return (
    <div className={styles.logo}>
      {url ? <img className={styles.logoImg} src={url} alt="" /> : <span className={styles.logoFallback}>—</span>}
    </div>
  );
}

/** ---------- Ladder → TeamStats (simple, stable) ---------- */
function toNum(s: string) {
  const n = Number(String(s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function norm(s: string) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function idxOf(headers: string[], wants: (string | RegExp)[]) {
  const H = (headers || []).map((h) => String(h || "").toLowerCase());
  for (let i = 0; i < H.length; i++) {
    for (const w of wants) {
      if (typeof w === "string") {
        if (H[i] === w || H[i].includes(w)) return i;
      } else {
        if (w.test(H[i])) return i;
      }
    }
  }
  return -1;
}

function getTeamStatsFromLadder(ladder: LadderPayload | undefined, teamLabel: string) {
  if (!ladder?.rows?.length) return null;

  const headers = ladder.headers || [];
  const rows = ladder.rows || [];

  const row = rows.find((r) => {
    const teamCell = r.cols?.[0] || r.team || "";
    return norm(teamCell) === norm(teamLabel);
  });

  if (!row?.cols?.length) return null;

  const iPlayed = idxOf(headers, [/^games?$/, "played", "gp"]);
  const iW = idxOf(headers, [/^win(s)?$/, "win"]);
  const iD = idxOf(headers, [/^draw(s)?$/, "draw"]);
  const iL = idxOf(headers, [/^loss(es)?$/, "loss"]);
  const iGF = idxOf(headers, [/^gf$/, "goals for", "for"]);
  const iGA = idxOf(headers, [/^ga$/, "goals against", "against"]);
  const iGD = idxOf(headers, [/^gd$/, "diff"]);
  const iPts = idxOf(headers, ["point", "pts"]);

  const played = iPlayed >= 0 ? toNum(row.cols[iPlayed]) : undefined;
  const wins = iW >= 0 ? toNum(row.cols[iW]) : undefined;
  const draws = iD >= 0 ? toNum(row.cols[iD]) : undefined;
  const losses = iL >= 0 ? toNum(row.cols[iL]) : undefined;
  const gf = iGF >= 0 ? toNum(row.cols[iGF]) : undefined;
  const ga = iGA >= 0 ? toNum(row.cols[iGA]) : undefined;
  const gd = iGD >= 0 ? toNum(row.cols[iGD]) : gf !== undefined && ga !== undefined ? gf - ga : undefined;
  const points = iPts >= 0 ? toNum(row.cols[iPts]) : undefined;

  return {
    team: teamLabel,
    played,
    wins,
    draws,
    losses,
    gf,
    ga,
    gd,
    points,
  };
}

export default function HeroMatch({
  activeGame,
  gamesSorted,
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
  activeIndex: number;
  setActiveIndex: (n: number) => void;
  setUserPinnedSelection: (v: boolean) => void;

  upcomingGames: Game[];
  showAllFixtureTabs: boolean;
  setShowAllFixtureTabs: (v: boolean) => void;

  now: Date;
  weather: Weather | null;
  isActiveUpcoming: boolean;

  onToast: (msg: string) => void;
  ladder?: LadderPayload;
}) {
  const heroCountdown = formatCountdown(new Date(activeGame.kickoffISO).getTime() - now.getTime());

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < gamesSorted.length - 1;

  function selectIndex(idx: number) {
    const safe = Math.min(Math.max(idx, 0), gamesSorted.length - 1);
    setUserPinnedSelection(true);
    setActiveIndex(safe);
  }

  // Pull both teams’ stats straight from ladder table (no clever matching)
  const teamAStats = getTeamStatsFromLadder(ladder, activeGame.home);
  const teamBStats = getTeamStatsFromLadder(ladder, activeGame.away);

  return (
    <section className={`${styles.card} ${styles.heroCard}`}>
      <div className={styles.cardPad}>
        <div className={styles.heroTop}>
          <div className={styles.heroLabels}>
            <span className={`${styles.pill} ${styles.pillGold}`}>{activeGame.roundLabel || "Round"}</span>
            <span className={`${styles.pill} ${styles.pillBlue}`}>{heroCountdown}</span>
            {!isActiveUpcoming ? <span className={`${styles.pill} ${styles.pillSoft}`}>Final</span> : null}
          </div>

          <div className={styles.heroNav}>
            <button className={`${styles.btn} ${styles.btnSoft}`} type="button" disabled={!canPrev} onClick={() => selectIndex(activeIndex - 1)}>
              <ChevronLeft size={16} /> Prior
            </button>
            <button className={`${styles.btn} ${styles.btnSoft}`} type="button" disabled={!canNext} onClick={() => selectIndex(activeIndex + 1)}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className={styles.fixtureTabsWrap}>
          <div className={styles.fixtureTabs}>
            {(showAllFixtureTabs ? upcomingGames : upcomingGames.slice(0, 6)).map((g) => {
              const isActive = makeSourceKey(g) === makeSourceKey(activeGame);
              return (
                <button
                  key={makeSourceKey(g)}
                  type="button"
                  onClick={() => {
                    setUserPinnedSelection(true);
                    const idx = gamesSorted.findIndex((x) => makeSourceKey(x) === makeSourceKey(g));
                    if (idx >= 0) setActiveIndex(idx);
                  }}
                  className={`${styles.fixtureTab} ${isActive ? styles.fixtureTabActive : ""}`}
                >
                  <span className={styles.fixtureTabTop}>{g.roundLabel || "Round"}</span>
                  <span className={styles.fixtureTabBottom}>{formatDayDateFromSource(g.date)}</span>
                </button>
              );
            })}

            {upcomingGames.length > 6 ? (
              <button
                className={styles.fixtureMore}
                type="button"
                onClick={() => {
                  setUserPinnedSelection(true);
                  setShowAllFixtureTabs(!showAllFixtureTabs);
                }}
              >
                {showAllFixtureTabs ? (
                  <>
                    Less <ChevronUp size={15} />
                  </>
                ) : (
                  <>
                    More <ChevronDown size={15} />
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.matchStack}>
          <div className={styles.matchTeamRow}>
            <Logo url={CLUB_LOGOS[clubKey(activeGame.home)]} />
            <div className={styles.matchTeamText}>
              <div className={styles.teamNameLg}>{shortTeamName(activeGame.home)}</div>
              <div className={styles.teamSub}>Home</div>
            </div>
          </div>

          <div className={styles.matchVs}>VS</div>

          <div className={styles.matchTeamRow}>
            <Logo url={CLUB_LOGOS[clubKey(activeGame.away)]} />
            <div className={styles.matchTeamText}>
              <div className={styles.teamNameLg}>{shortTeamName(activeGame.away)}</div>
              <div className={styles.teamSub}>Away</div>
            </div>
          </div>

          {!isActiveUpcoming && activeGame.score ? <div className={styles.resultPill}>Result: {activeGame.score}</div> : null}
        </div>

        <div className={styles.metaStrip}>
          <div className={styles.metaItem}>
            <CalendarDays size={15} />
            {formatLongDateFromSource(activeGame.date)}
          </div>
          <div className={styles.metaItem}>
            <Clock3 size={15} />
            {formatTimeFromSource(activeGame.time)}
          </div>
          <div className={styles.metaItem}>
            <MapPin size={15} />
            {activeGame.venue}
          </div>
        </div>

        {weather?.ok ? (
          <div className={styles.weatherRow}>
            <span className={`${styles.pill} ${styles.pillSoft}`}>
              <CloudSun size={14} /> {weather.tempC ?? "—"}°C
            </span>
            <span className={`${styles.pill} ${styles.pillSoft}`}>
              <Droplets size={14} /> {weather.precipMM ?? "—"}mm
            </span>
            <span className={`${styles.pill} ${styles.pillSoft}`}>
              <Wind size={14} /> {weather.windKmh ?? "—"}km/h
            </span>
          </div>
        ) : null}

        <div className={styles.heroSection}>
          <HeadToHead
            allGames={gamesSorted}
            teamA={activeGame.home}
            teamB={activeGame.away}
            teamAStats={teamAStats}
            teamBStats={teamBStats}
          />
        </div>

        <div className={styles.heroSection}>
          <AvailabilityBlock game={activeGame} onToast={onToast} />
        </div>
      </div>
    </section>
  );
}
