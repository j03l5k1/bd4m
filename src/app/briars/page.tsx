"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  CloudSun,
  Droplets,
  LogOut,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
  Wind,
} from "lucide-react";
import styles from "./briars.module.css";

type Game = {
  date: string;
  time: string;
  venue: string;
  roundLabel: string;
  home: string;
  away: string;
  score: string;
  kickoffISO: string;
};

type LadderPayload = {
  headers: string[];
  rows: { team: string; cols: string[] }[];
};

type Payload = {
  ok: boolean;
  team: string;
  source: string;
  refreshedAt: string;
  games: Game[];
  ladder?: LadderPayload;
};

type Counts = { yes: number; no: number; maybe: number };
type NamesByStatus = { yes: string[]; maybe: string[]; no: string[] };

type Weather = {
  ok: boolean;
  at?: string;
  tempC?: number;
  precipMM?: number;
  windKmh?: number;
  location?: string;
};

const LS_PIN_OK = "briars_pin_ok";
const LS_PLAYER_NAME = "briars_player_name";
const LS_TEAM_PIN = "briars_team_pin";

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

function makeLegacySourceKey(g: Game) {
  return `${g.kickoffISO}|${g.home}|${g.away}`;
}

function normaliseName(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function mergeUnique(a: string[], b: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a, ...b]) {
    const k = normaliseName(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function mergeNames(a?: Partial<NamesByStatus>, b?: Partial<NamesByStatus>): NamesByStatus {
  return {
    yes: mergeUnique(a?.yes || [], b?.yes || []),
    maybe: mergeUnique(a?.maybe || [], b?.maybe || []),
    no: mergeUnique(a?.no || [], b?.no || []),
  };
}

function mergeCounts(a?: Partial<Counts>, b?: Partial<Counts>): Counts {
  return {
    yes: (a?.yes || 0) + (b?.yes || 0),
    maybe: (a?.maybe || 0) + (b?.maybe || 0),
    no: (a?.no || 0) + (b?.no || 0),
  };
}

function statusFromNames(names: NamesByStatus, playerName: string): "yes" | "maybe" | "no" | undefined {
  const needle = normaliseName(playerName);
  if (!needle) return undefined;
  if (names.yes.some((n) => normaliseName(n) === needle)) return "yes";
  if (names.maybe.some((n) => normaliseName(n) === needle)) return "maybe";
  if (names.no.some((n) => normaliseName(n) === needle)) return "no";
  return undefined;
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
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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

function normaliseTeamName(team: string) {
  return team.toLowerCase().replace(/\s+/g, " ").trim();
}

function num(x: string | undefined) {
  if (!x) return 0;
  const n = Number(String(x).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function ordinal(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function rankEmoji(rank?: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Started";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  return `${days}d ${hours}h ${mins}m`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toICSUTC(dt: Date) {
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(
    dt.getUTCHours()
  )}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
}

function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildAllGamesICS(games: Game[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Briars Fixtures//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const g of games) {
    const start = new Date(g.kickoffISO);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const uid = `${makeSourceKey(g).replace(/[^\w]/g, "")}@briarsfixtures`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toICSUTC(new Date())}`);
    lines.push(`DTSTART:${toICSUTC(start)}`);
    lines.push(`DTEND:${toICSUTC(end)}`);
    lines.push(`SUMMARY:${escapeICS(`${g.home} vs ${g.away}`)}`);
    lines.push(`DESCRIPTION:${escapeICS(`${g.roundLabel} • ${g.home} vs ${g.away}`)}`);
    lines.push(`LOCATION:${escapeICS(g.venue)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadICS(games: Game[]) {
  const text = buildAllGamesICS(games);
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "briars-fixtures.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Pill({
  children,
  tone = "default",
  active = false,
}: {
  children: React.ReactNode;
  tone?: "default" | "gold" | "blue" | "green" | "map" | "soft";
  active?: boolean;
}) {
  const toneClass =
    tone === "gold"
      ? styles.pillGold
      : tone === "blue"
      ? styles.pillBlue
      : tone === "green"
      ? styles.pillGreen
      : tone === "map"
      ? styles.pillMap
      : tone === "soft"
      ? styles.pillSoft
      : "";

  return <span className={`${styles.pill} ${toneClass} ${active ? styles.pillActive : ""}`}>{children}</span>;
}

function Button({
  children,
  onClick,
  kind = "primary",
  active = false,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "soft";
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`${styles.btn} ${kind === "primary" ? styles.btnPrimary : styles.btnSoft} ${
        active ? styles.btnActive : ""
      }`}
      onClick={onClick}
      disabled={disabled}
      type="button"
      style={disabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
    >
      {children}
    </button>
  );
}

function Logo({ url }: { url?: string }) {
  return (
    <div className={styles.logo}>
      {url ? <img className={styles.logoImg} src={url} alt="" /> : <span className={styles.logoFallback}>—</span>}
    </div>
  );
}

export default function BriarsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const [countsByKey, setCountsByKey] = useState<Record<string, Counts>>({});
  const [namesByKey, setNamesByKey] = useState<Record<string, NamesByStatus>>({});
  const [myStatusByKey, setMyStatusByKey] = useState<Record<string, "yes" | "no" | "maybe">>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [activeUpcomingIndex, setActiveUpcomingIndex] = useState(0);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [showAllFixtureTabs, setShowAllFixtureTabs] = useState(false);
  const [ladderSortKey, setLadderSortKey] = useState("PTS");
  const [ladderSortDir, setLadderSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
    setPlayerName(localStorage.getItem(LS_PLAYER_NAME) || "");
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/briars-fixtures", { cache: "no-store" });
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const games = data?.games ?? [];
    const u: Game[] = [];
    const p: Game[] = [];

    for (const g of games) {
      const dt = new Date(g.kickoffISO);
      if (dt.getTime() >= now.getTime()) u.push(g);
      else p.push(g);
    }

    u.sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());
    p.sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime());

    return { upcoming: u, past: p };
  }, [data, now]);

  const activeGame = upcoming[activeUpcomingIndex] || upcoming[0] || null;

  useEffect(() => {
    if (!upcoming.length) return;
    if (activeUpcomingIndex > upcoming.length - 1) setActiveUpcomingIndex(0);
  }, [upcoming.length, activeUpcomingIndex]);

  async function fetchSummary(sourceKey: string) {
    try {
      const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(sourceKey)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.ok) return json.counts as Counts;
    } catch {}
    return undefined;
  }

  async function fetchNames(sourceKey: string) {
    try {
      const res = await fetch(`/api/availability/names?source_key=${encodeURIComponent(sourceKey)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.ok) return json.names as NamesByStatus;
    } catch {}
    return undefined;
  }

  async function loadAvailabilityForGame(g: Game) {
    const stableKey = makeSourceKey(g);
    const legacyKey = makeLegacySourceKey(g);

    const [stableCounts, legacyCounts, stableNames, legacyNames] = await Promise.all([
      fetchSummary(stableKey),
      legacyKey !== stableKey ? fetchSummary(legacyKey) : Promise.resolve(undefined),
      fetchNames(stableKey),
      legacyKey !== stableKey ? fetchNames(legacyKey) : Promise.resolve(undefined),
    ]);

    const mergedNames = mergeNames(stableNames, legacyNames);
    const mergedCounts =
      mergedNames.yes.length || mergedNames.maybe.length || mergedNames.no.length
        ? {
            yes: mergedNames.yes.length,
            maybe: mergedNames.maybe.length,
            no: mergedNames.no.length,
          }
        : mergeCounts(stableCounts, legacyCounts);

    setNamesByKey((prev) => ({ ...prev, [stableKey]: mergedNames }));
    setCountsByKey((prev) => ({ ...prev, [stableKey]: mergedCounts }));

    const mine = statusFromNames(mergedNames, playerName);
    if (mine) setMyStatusByKey((prev) => ({ ...prev, [stableKey]: mine }));
  }

  useEffect(() => {
    (async () => {
      for (const g of upcoming.slice(0, 12)) {
        await loadAvailabilityForGame(g);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming.length]);

  useEffect(() => {
    const name = playerName.trim();
    if (!name) return;

    const next: Record<string, "yes" | "no" | "maybe"> = {};
    for (const [key, names] of Object.entries(namesByKey)) {
      const mine = statusFromNames(names, name);
      if (mine) next[key] = mine;
    }

    setMyStatusByKey((prev) => ({ ...prev, ...next }));
  }, [playerName, namesByKey]);

  useEffect(() => {
    (async () => {
      if (!activeGame) {
        setWeather(null);
        return;
      }

      try {
        const res = await fetch(`/api/weather/homebush?kickoffISO=${encodeURIComponent(activeGame.kickoffISO)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        setWeather(json);
      } catch {
        setWeather(null);
      }
    })();
  }, [activeGame?.kickoffISO]);

  function persistName(next: string) {
    setPlayerName(next);
    const n = next.trim();
    if (n.length >= 2) localStorage.setItem(LS_PLAYER_NAME, n);
  }

  function flash(msg: string, ms = 1800) {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  }

  function rememberPin() {
    if (pinInput.trim() !== "briars2026") {
      flash("Wrong PIN", 2200);
      return;
    }
    localStorage.setItem(LS_PIN_OK, "1");
    localStorage.setItem(LS_TEAM_PIN, "briars2026");
    setPinOk(true);
    setPinInput("");
    flash("PIN saved ✓", 2000);
  }

  function logout() {
    localStorage.removeItem(LS_PIN_OK);
    localStorage.removeItem(LS_TEAM_PIN);
    setPinOk(false);
    flash("Logged out", 1600);
  }

  async function setStatus(g: Game, status: "yes" | "no" | "maybe") {
    if (!pinOk) return flash("Enter the team PIN first.", 2500);

    const n = playerName.trim();
    if (n.length < 2) return flash("Enter your name first.", 2500);

    const stableKey = makeSourceKey(g);
    setSavingKey(stableKey);

    try {
      const res = await fetch("/api/availability/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: localStorage.getItem(LS_TEAM_PIN) || "",
          playerName: n,
          status,
          game: {
            source_key: stableKey,
            legacy_source_key: makeLegacySourceKey(g),
            kickoff_iso: g.kickoffISO,
            home: g.home,
            away: g.away,
            venue: g.venue,
            date: g.date,
            time: g.time,
          },
        }),
      });

      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Failed to save");

      setMyStatusByKey((prev) => ({ ...prev, [stableKey]: status }));
      flash("Saved ✓");
      await loadAvailabilityForGame(g);
    } catch (e: any) {
      flash(e?.message || "Something went wrong", 3000);
    } finally {
      setSavingKey(null);
    }
  }

  const ladder = data?.ladder;
  const ladderHeaders = ladder?.headers || [];
  const ladderRows = ladder?.rows || [];

  const headerIndex = useMemo(() => {
    const map: Record<string, number> = {};
    ladderHeaders.forEach((h, i) => {
      map[h.trim().toLowerCase()] = i;
    });
    return map;
  }, [ladderHeaders]);

  function findIndexByNames(names: string[]) {
    for (const n of names) {
      const idx = headerIndex[n.toLowerCase()];
      if (typeof idx === "number") return idx;
    }
    return -1;
  }

  const idxTeam = 0;
  const idxPts = findIndexByNames(["pts", "points"]);
  const idxGD = findIndexByNames(["gd", "goal difference", "+/-"]);
  const idxGF = findIndexByNames(["gf", "for", "g+"]);
  const idxGA = findIndexByNames(["ga", "against", "g-"]);

  const rankedLadderRows = useMemo(() => {
    const rows = [...ladderRows];
    rows.sort((a, b) => {
      const aPts = idxPts >= 0 ? num(a.cols[idxPts]) : 0;
      const bPts = idxPts >= 0 ? num(b.cols[idxPts]) : 0;
      if (bPts !== aPts) return bPts - aPts;

      const aGD = idxGD >= 0 ? num(a.cols[idxGD]) : 0;
      const bGD = idxGD >= 0 ? num(b.cols[idxGD]) : 0;
      if (bGD !== aGD) return bGD - aGD;

      const aGFv = idxGF >= 0 ? num(a.cols[idxGF]) : 0;
      const bGFv = idxGF >= 0 ? num(b.cols[idxGF]) : 0;
      if (bGFv !== aGFv) return bGFv - aGFv;

      return String(a.cols[idxTeam]).localeCompare(String(b.cols[idxTeam]));
    });
    return rows;
  }, [ladderRows, idxPts, idxGD, idxGF]);

  const sortedLadderRows = useMemo(() => {
    const rows = [...rankedLadderRows];
    const idx = headerIndex[ladderSortKey.toLowerCase()];
    if (typeof idx !== "number") return rows;

    rows.sort((a, b) => {
      const av = num(a.cols[idx]);
      const bv = num(b.cols[idx]);
      if (av === bv) return String(a.cols[0] || "").localeCompare(String(b.cols[0] || ""));
      return ladderSortDir === "desc" ? bv - av : av - bv;
    });

    return rows;
  }, [rankedLadderRows, headerIndex, ladderSortDir, ladderSortKey]);

  const teamRankMap = useMemo(() => {
    const map: Record<string, number> = {};
    rankedLadderRows.forEach((row, index) => {
      const name = String(row.cols[idxTeam] || row.team || "");
      if (!name) return;
      map[normaliseTeamName(name)] = index + 1;
    });
    return map;
  }, [rankedLadderRows, idxTeam]);

  function findLadderRowForTeam(teamName: string) {
    const needle = normaliseTeamName(teamName);
    const direct = rankedLadderRows.find(
      (row) => normaliseTeamName(String(row.cols[idxTeam] || row.team || "")) === needle
    );
    if (direct) return direct;

    const short = shortTeamName(teamName).toLowerCase();
    return rankedLadderRows.find((row) => String(row.cols[idxTeam] || row.team || "").toLowerCase().includes(short));
  }

  function getTeamRank(teamName: string) {
    const direct = teamRankMap[normaliseTeamName(teamName)];
    if (direct) return direct;

    const row = findLadderRowForTeam(teamName);
    if (!row) return undefined;

    const rowName = String(row.cols[idxTeam] || row.team || "");
    return teamRankMap[normaliseTeamName(rowName)];
  }

  function teamDisplayLabel(teamName: string) {
    const short = shortTeamName(teamName);
    const rank = getTeamRank(teamName);
    if (!rank) return short;
    const emoji = rankEmoji(rank);
    return `${short}${emoji ? ` ${emoji}` : ""} (${ordinal(rank)})`;
  }

  function compareStat(homeVal: number, awayVal: number) {
    const total = Math.max(homeVal + awayVal, 1);
    const homePct = (homeVal / total) * 100;
    const awayPct = 100 - homePct;
    return { homePct, awayPct };
  }

  function HeadToHead({ g }: { g: Game }) {
    const homeRow = findLadderRowForTeam(g.home);
    const awayRow = findLadderRowForTeam(g.away);

    if (!homeRow || !awayRow) {
      return (
        <details className={styles.details}>
          <summary className={styles.summary}>
            <span>Head-to-head</span>
            <span className={styles.summaryRight}>
              Compare <ChevronDown size={16} />
            </span>
          </summary>
          <div className={styles.detailsBody}>Not enough ladder data yet.</div>
        </details>
      );
    }

    const homeRank = getTeamRank(g.home) || 0;
    const awayRank = getTeamRank(g.away) || 0;
    const homePts = idxPts >= 0 ? num(homeRow.cols[idxPts]) : 0;
    const awayPts = idxPts >= 0 ? num(awayRow.cols[idxPts]) : 0;
    const homeGF = idxGF >= 0 ? num(homeRow.cols[idxGF]) : 0;
    const awayGF = idxGF >= 0 ? num(awayRow.cols[idxGF]) : 0;
    const homeGA = idxGA >= 0 ? num(homeRow.cols[idxGA]) : 0;
    const awayGA = idxGA >= 0 ? num(awayRow.cols[idxGA]) : 0;
    const homeGD = idxGD >= 0 ? num(homeRow.cols[idxGD]) : 0;
    const awayGD = idxGD >= 0 ? num(awayRow.cols[idxGD]) : 0;

    const edge =
      homePts === awayPts && homeGD === awayGD
        ? "Looks very even"
        : homePts > awayPts || homeGD > awayGD
        ? `${shortTeamName(g.home)} slight edge`
        : `${shortTeamName(g.away)} slight edge`;

    const stats = [
      { label: "Points", home: homePts, away: awayPts },
      { label: "Goals for", home: homeGF, away: awayGF },
      { label: "Goals against", home: homeGA, away: awayGA, invert: true },
      { label: "Goal diff", home: Math.max(homeGD, 0), away: Math.max(awayGD, 0) },
    ];

    return (
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span>Head-to-head</span>
          <span className={styles.summaryRight}>
            {edge} <ChevronDown size={16} />
          </span>
        </summary>
        <div className={styles.detailsBody}>
          <div className={styles.h2hTop}>
            <div className={styles.h2hTeam}>
              <strong>{shortTeamName(g.home)}</strong>
              <span>{ordinal(homeRank)}</span>
            </div>
            <div className={styles.h2hCenter}>{edge}</div>
            <div className={`${styles.h2hTeam} ${styles.h2hTeamRight}`}>
              <strong>{shortTeamName(g.away)}</strong>
              <span>{ordinal(awayRank)}</span>
            </div>
          </div>

          <div className={styles.h2hStats}>
            {stats.map((s) => {
              const visualHome = s.invert ? s.away : s.home;
              const visualAway = s.invert ? s.home : s.away;
              const { homePct, awayPct } = compareStat(visualHome, visualAway);

              return (
                <div key={s.label} className={styles.statRow}>
                  <div className={styles.statValues}>
                    <span>{s.home}</span>
                    <span>{s.label}</span>
                    <span>{s.away}</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barHome} style={{ width: `${homePct}%` }} />
                    <div className={styles.barAway} style={{ width: `${awayPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    );
  }

  function AvailabilityBlock({ g }: { g: Game }) {
    const key = makeSourceKey(g);
    const names = namesByKey[key] || { yes: [], maybe: [], no: [] };
    const counts = countsByKey[key] || { yes: 0, maybe: 0, no: 0 };
    const mine = myStatusByKey[key];
    const saving = savingKey === key;

    return (
      <div className={styles.availabilityBox}>
        {!pinOk || !playerName.trim() ? (
          <div className={styles.loginGrid}>
            <div>
              <div className={styles.label}>Your name</div>
              <input
                className={styles.input}
                value={playerName}
                onChange={(e) => persistName(e.target.value)}
                placeholder="Joel A"
              />
            </div>

            <div>
              <div className={styles.label}>Team PIN</div>
              <div className={styles.inlineRow}>
                <input
                  className={styles.input}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter team PIN"
                />
                <Button onClick={rememberPin}>Save</Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.availabilityTop}>
          <div>
            <div className={styles.eyebrow}>Availability</div>
            <div className={styles.availabilityTitle}>
              {mine === "yes" ? "You’re in" : mine === "maybe" ? "You’re maybe" : mine === "no" ? "You’re out" : "Set your status"}
              {saving ? " • saving..." : ""}
            </div>
          </div>

          <div className={styles.countsWrap}>
            <Pill tone="green">✅ {counts.yes}</Pill>
            <Pill tone="gold">❓ {counts.maybe}</Pill>
            <Pill tone="soft">❌ {counts.no}</Pill>
          </div>
        </div>

        <div className={styles.btnRow}>
          <Button onClick={() => setStatus(g, "yes")} active={mine === "yes"} disabled={saving}>
            ✅ I’m in
          </Button>
          <Button onClick={() => setStatus(g, "maybe")} kind="soft" active={mine === "maybe"} disabled={saving}>
            ❓ Maybe
          </Button>
          <Button onClick={() => setStatus(g, "no")} kind="soft" active={mine === "no"} disabled={saving}>
            ❌ Out
          </Button>
        </div>

        <details className={styles.details}>
          <summary className={styles.summary}>
            <span>View squad status</span>
            <span className={styles.summaryRight}>
              <Users size={15} /> {counts.yes + counts.maybe + counts.no} responses
            </span>
          </summary>
          <div className={styles.detailsBody}>
            <div className={styles.availabilityNamesGrid}>
              <div className={styles.nameCol}>
                <div className={styles.nameColTitle}>✅ In</div>
                <div className={styles.nameColBody}>{names.yes.length ? names.yes.join(", ") : "—"}</div>
              </div>
              <div className={styles.nameCol}>
                <div className={styles.nameColTitle}>❓ Maybe</div>
                <div className={styles.nameColBody}>{names.maybe.length ? names.maybe.join(", ") : "—"}</div>
              </div>
              <div className={styles.nameCol}>
                <div className={styles.nameColTitle}>❌ Out</div>
                <div className={styles.nameColBody}>{names.no.length ? names.no.join(", ") : "—"}</div>
              </div>
            </div>
          </div>
        </details>
      </div>
    );
  }

  if (loading) {
    return <div className={styles.shell}>Loading…</div>;
  }

  if (!data) {
    return <div className={styles.shell}>Could not load fixtures.</div>;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Briars Fixtures</h1>
          <div className={styles.sub}>
            Source: <span className={styles.strong}>{data.source}</span> • Refreshed {data.refreshedAt}
          </div>
        </div>

        <div className={styles.actions}>
          {toast ? <span className={styles.toast}>{toast}</span> : null}
          <Button kind="soft" onClick={() => downloadICS(data.games)}>
            <CalendarDays size={16} />
            Add all games to calendar
          </Button>
          {pinOk ? (
            <Button kind="soft" onClick={logout}>
              <LogOut size={16} />
              Log out
            </Button>
          ) : null}
        </div>
      </header>

      {activeGame ? (
        <section className={`${styles.card} ${styles.heroCard}`}>
          <div className={styles.cardPad}>
            <div className={styles.heroTop}>
              <div className={styles.heroLabels}>
                <Pill tone="gold">{activeUpcomingIndex === 0 ? "Next game" : activeGame.roundLabel}</Pill>
                <Pill tone="blue">{formatCountdown(new Date(activeGame.kickoffISO).getTime() - now.getTime())}</Pill>
              </div>
            </div>

            <div className={styles.fixtureTabsWrap}>
              <div className={styles.fixtureTabs}>
                {(showAllFixtureTabs ? upcoming : upcoming.slice(0, 6)).map((g, i) => {
                  const isActive = i === activeUpcomingIndex;
                  return (
                    <button
                      key={makeSourceKey(g)}
                      type="button"
                      onClick={() => setActiveUpcomingIndex(i)}
                      className={`${styles.fixtureTab} ${isActive ? styles.fixtureTabActive : ""}`}
                    >
                      <span className={styles.fixtureTabTop}>{i === 0 ? "Next" : g.roundLabel}</span>
                      <span className={styles.fixtureTabBottom}>{formatDayDateFromSource(g.date)}</span>
                    </button>
                  );
                })}

                {upcoming.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllFixtureTabs((v) => !v)}
                    className={styles.fixtureMore}
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

            <div className={styles.matchRow}>
              <div className={styles.teamBlock}>
                <Logo url={CLUB_LOGOS[clubKey(activeGame.home)]} />
                <div>
                  <div className={styles.teamNameLg}>{teamDisplayLabel(activeGame.home)}</div>
                  <div className={styles.teamSub}>Home</div>
                </div>
              </div>

              <div className={styles.vsBlock}>
                <div className={styles.vsText}>VS</div>
                <div className={styles.vsSub}>{activeGame.roundLabel}</div>
              </div>

              <div className={`${styles.teamBlock} ${styles.teamBlockRight}`}>
                <div>
                  <div className={styles.teamNameLg}>{teamDisplayLabel(activeGame.away)}</div>
                  <div className={styles.teamSub}>Away</div>
                </div>
                <Logo url={CLUB_LOGOS[clubKey(activeGame.away)]} />
              </div>
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
                <Pill tone="soft">
                  <CloudSun size={14} /> {weather.tempC ?? "—"}°C
                </Pill>
                <Pill tone="soft">
                  <Droplets size={14} /> {weather.precipMM ?? "—"}mm
                </Pill>
                <Pill tone="soft">
                  <Wind size={14} /> {weather.windKmh ?? "—"}km/h
                </Pill>
              </div>
            ) : null}

            <div className={styles.heroSection}>
              <AvailabilityBlock g={activeGame} />
            </div>

            <div className={styles.heroSection}>
              <HeadToHead g={activeGame} />
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionTop}>
          <h2 className={styles.sectionTitle}>Upcoming fixtures</h2>
        </div>

        <div className={styles.upcomingList}>
          {upcoming.map((g, i) => {
            const key = makeSourceKey(g);
            const counts = countsByKey[key] || { yes: 0, maybe: 0, no: 0 };
            const mine = myStatusByKey[key];
            const active = activeGame && makeSourceKey(activeGame) === key;

            return (
              <button
                key={key}
                type="button"
                className={`${styles.fixtureRow} ${active ? styles.fixtureRowActive : ""}`}
                onClick={() => setActiveUpcomingIndex(i)}
              >
                <div className={styles.fixtureRowMain}>
                  <div className={styles.fixtureRowTitle}>
                    {shortTeamName(g.home)} v {shortTeamName(g.away)}
                  </div>
                  <div className={styles.fixtureRowSub}>
                    {formatDayDateFromSource(g.date)} • {formatTimeFromSource(g.time)} • {g.venue}
                  </div>
                </div>

                <div className={styles.fixtureRowSide}>
                  <Pill tone="blue">{formatCountdown(new Date(g.kickoffISO).getTime() - now.getTime())}</Pill>
                  <div className={styles.fixtureMiniStatus}>
                    <span>{mine === "yes" ? "In" : mine === "maybe" ? "Maybe" : mine === "no" ? "Out" : "Not set"}</span>
                    <span>
                      ✅ {counts.yes} • ❓ {counts.maybe} • ❌ {counts.no}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {ladderRows.length ? (
        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2 className={styles.sectionTitle}>Ladder</h2>
          </div>

          <div className={styles.ladderWrap}>
            <table className={styles.ladder}>
              <thead>
                <tr>
                  {ladderHeaders.map((h) => {
                    const active = ladderSortKey.toLowerCase() === h.toLowerCase();
                    return (
                      <th
                        key={h}
                        className={`${styles.ladderTh} ${active ? styles.ladderThActive : ""}`}
                        onClick={() => {
                          if (active) {
                            setLadderSortDir((d) => (d === "desc" ? "asc" : "desc"));
                          } else {
                            setLadderSortKey(h);
                            setLadderSortDir("desc");
                          }
                        }}
                      >
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedLadderRows.map((row, i) => {
                  const teamName = String(row.cols[0] || row.team || "");
                  const isBriars = teamName.toLowerCase().includes("briars");

                  return (
                    <tr key={`${teamName}-${i}`} className={isBriars ? styles.ladderBriars : ""}>
                      {row.cols.map((col, j) => (
                        <td key={`${teamName}-${j}`} className={styles.ladderTd}>
                          {col}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {past.length ? (
        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2 className={styles.sectionTitle}>Past results</h2>
          </div>

          <div className={styles.pastList}>
            {past.slice(0, 6).map((g) => (
              <div key={makeSourceKey(g)} className={styles.pastCard}>
                <div className={styles.pastTitle}>
                  {shortTeamName(g.home)} v {shortTeamName(g.away)}
                </div>
                <div className={styles.pastSub}>
                  {formatDayDateFromSource(g.date)} • {g.score || "Result pending"}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
