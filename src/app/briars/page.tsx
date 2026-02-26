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
  const names = mergeNames(
    {
      yes: new Array(a?.yes || 0).fill("x"),
      maybe: new Array(a?.maybe || 0).fill("x"),
      no: new Array(a?.no || 0).fill("x"),
    },
    {
      yes: new Array(b?.yes || 0).fill("y"),
      maybe: new Array(b?.maybe || 0).fill("y"),
      no: new Array(b?.no || 0).fill("y"),
    }
  );

  return {
    yes: names.yes.length,
    maybe: names.maybe.length,
    no: names.no.length,
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

function formatCountdown(ms: number) {
  if (ms <= 0) return "Started";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  return `${days}d ${hours}h ${mins}m`;
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

function normaliseTeamName(team: string) {
  return team.toLowerCase().replace(/\s+/g, " ").trim();
}

function Pill({
  children,
  subtle,
  tone = "default",
}: {
  children: React.ReactNode;
  subtle?: boolean;
  tone?: "default" | "gold" | "blue" | "green" | "map";
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
      : "";

  return (
    <span className={`${styles.pill} ${subtle ? styles.pillSubtle : ""} ${toneClass}`}>
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  kind = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "soft";
  disabled?: boolean;
}) {
  return (
    <button
      className={`${styles.btn} ${kind === "primary" ? styles.btnPrimary : styles.btnSoft}`}
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

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [ladderSortKey, setLadderSortKey] = useState("PTS");
  const [ladderSortDir, setLadderSortDir] = useState<"asc" | "desc">("desc");
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
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

  const { upcoming, past, nextGame } = useMemo(() => {
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

    return { upcoming: u, past: p, nextGame: u[0] || null };
  }, [data, now]);

  async function fetchSummary(sourceKey: string) {
    try {
      const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(sourceKey)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.ok) return json.counts as Counts;
    } catch {
      //
    }
    return undefined;
  }

  async function fetchNames(sourceKey: string) {
    try {
      const res = await fetch(`/api/availability/names?source_key=${encodeURIComponent(sourceKey)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.ok) return json.names as NamesByStatus;
    } catch {
      //
    }
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
    if (mine) {
      setMyStatusByKey((prev) => ({ ...prev, [stableKey]: mine }));
    }
  }

  useEffect(() => {
    (async () => {
      for (const g of upcoming.slice(0, 30)) {
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
      if (!nextGame) return setWeather(null);
      try {
        const res = await fetch(`/api/weather/homebush?kickoffISO=${encodeURIComponent(nextGame.kickoffISO)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        setWeather(json);
      } catch {
        setWeather(null);
      }
    })();
  }, [nextGame?.kickoffISO]);

  const loginComplete = useMemo(() => {
    return pinOk && playerName.trim().length >= 2;
  }, [pinOk, playerName]);

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
  const idxP = findIndexByNames(["p", "pld", "played", "games"]);
  const idxW = findIndexByNames(["w", "won", "wins", "win"]);
  const idxD = findIndexByNames(["d", "draw", "draws"]);
  const idxL = findIndexByNames(["l", "loss", "losses"]);

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
    if (!ladderSortKey) return rows;

    const idx = headerIndex[ladderSortKey.toLowerCase()];
    if (typeof idx !== "number") return rows;

    rows.sort((a, b) => {
      const av = num(a.cols[idx]);
      const bv = num(b.cols[idx]);

      if (av === bv) {
        return String(a.cols[0] || "").localeCompare(String(b.cols[0] || ""));
      }

      return ladderSortDir === "desc" ? bv - av : av - bv;
    });

    return rows;
  }, [rankedLadderRows, ladderSortKey, ladderSortDir, headerIndex]);

  const teamRankMap = useMemo(() => {
    const map: Record<string, number> = {};
    rankedLadderRows.forEach((row, index) => {
      const name = String(row.cols[idxTeam] || row.team || "");
      if (!name) return;
      map[normaliseTeamName(name)] = index + 1;
    });
    return map;
  }, [rankedLadderRows]);

  function findLadderRowForTeam(teamName: string) {
    const needle = normaliseTeamName(teamName);

    const direct = rankedLadderRows.find(
      (row) => normaliseTeamName(String(row.cols[idxTeam] || row.team || "")) === needle
    );
    if (direct) return direct;

    const short = shortTeamName(teamName).toLowerCase();
    return rankedLadderRows.find((row) => {
      const rowName = String(row.cols[idxTeam] || row.team || "").toLowerCase();
      return rowName.includes(short);
    });
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
    return `${short} ${emoji ? `${emoji} ` : ""}(${ordinal(rank)})`;
  }

  function AvailabilityBlock({ g }: { g: Game }) {
    const key = makeSourceKey(g);
    const names = namesByKey[key] || { yes: [], maybe: [], no: [] };
    const counts = countsByKey[key] || { yes: 0, maybe: 0, no: 0 };
    const mine = myStatusByKey[key];
    const saving = savingKey === key;

    return (
      <div className={styles.availabilityBox}>
        <div className={styles.availabilityTop}>
          <div className={styles.availabilityTitle}>Availability</div>
          <Pill tone="gold">
            <Users size={15} /> ✅ {counts.yes} / ❓ {counts.maybe} / ❌ {counts.no}
          </Pill>
        </div>

        <div className={styles.statusLine}>
          Your status:{" "}
          <span className={styles.statusStrong}>
            {mine === "yes" ? "In" : mine === "maybe" ? "Maybe" : mine === "no" ? "Out" : "Not set"}
            {saving ? " (saving…)" : ""}
          </span>
        </div>

        <div className={styles.btnRow}>
          <Button onClick={() => setStatus(g, "yes")} disabled={saving}>
            ✅ I’m in
          </Button>
          <Button onClick={() => setStatus(g, "maybe")} kind="soft" disabled={saving}>
            ❓ Maybe
          </Button>
          <Button onClick={() => setStatus(g, "no")} kind="soft" disabled={saving}>
            ❌ Out
          </Button>
        </div>

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
    );
  }

  function HeadToHead({ homeTeam, awayTeam }: { homeTeam: string; awayTeam: string }) {
    const homeRow = findLadderRowForTeam(homeTeam);
    const awayRow = findLadderRowForTeam(awayTeam);

    if (!homeRow || !awayRow) {
      return (
        <div style={{ marginTop: 12, color: "var(--muted)", fontWeight: 850 }}>
          Comparison not available yet.
        </div>
      );
    }

    const homeRank = getTeamRank(homeTeam);
    const awayRank = getTeamRank(awayTeam);

    const metrics = [
      {
        key: "position",
        label: "Ladder position",
        home: homeRank ?? 0,
        away: awayRank ?? 0,
        lowWins: true,
        format: (v: number) => (v ? ordinal(v) : "—"),
      },
      { key: "games", label: "Games played", home: idxP >= 0 ? num(homeRow.cols[idxP]) : 0, away: idxP >= 0 ? num(awayRow.cols[idxP]) : 0 },
      { key: "wins", label: "Wins", home: idxW >= 0 ? num(homeRow.cols[idxW]) : 0, away: idxW >= 0 ? num(awayRow.cols[idxW]) : 0 },
      { key: "draws", label: "Draws", home: idxD >= 0 ? num(homeRow.cols[idxD]) : 0, away: idxD >= 0 ? num(awayRow.cols[idxD]) : 0 },
      { key: "losses", label: "Losses", home: idxL >= 0 ? num(homeRow.cols[idxL]) : 0, away: idxL >= 0 ? num(awayRow.cols[idxL]) : 0, lowWins: true },
      { key: "gf", label: "Goals for", home: idxGF >= 0 ? num(homeRow.cols[idxGF]) : 0, away: idxGF >= 0 ? num(awayRow.cols[idxGF]) : 0 },
      { key: "ga", label: "Goals against", home: idxGA >= 0 ? num(homeRow.cols[idxGA]) : 0, away: idxGA >= 0 ? num(awayRow.cols[idxGA]) : 0, lowWins: true },
      { key: "gd", label: "Goal difference", home: idxGD >= 0 ? num(homeRow.cols[idxGD]) : 0, away: idxGD >= 0 ? num(awayRow.cols[idxGD]) : 0 },
      { key: "pts", label: "Points", home: idxPts >= 0 ? num(homeRow.cols[idxPts]) : 0, away: idxPts >= 0 ? num(awayRow.cols[idxPts]) : 0 },
    ];

    function isHomeBetter(metric: (typeof metrics)[number]) {
      return metric.lowWins ? metric.home < metric.away : metric.home > metric.away;
    }

    function isAwayBetter(metric: (typeof metrics)[number]) {
      return metric.lowWins ? metric.away < metric.home : metric.away > metric.home;
    }

    function getStrengths(metric: (typeof metrics)[number]) {
      const a = metric.home;
      const b = metric.away;

      if (a === 0 && b === 0) return { homePct: 50, awayPct: 50 };

      if (metric.lowWins) {
        const maxVal = Math.max(a, b, 1);
        const homeScore = maxVal - a + 1;
        const awayScore = maxVal - b + 1;
        const maxScore = Math.max(homeScore, awayScore, 1);
        return {
          homePct: Math.max(18, (homeScore / maxScore) * 100),
          awayPct: Math.max(18, (awayScore / maxScore) * 100),
        };
      }

      const maxVal = Math.max(a, b, 1);
      return {
        homePct: Math.max(18, (a / maxVal) * 100),
        awayPct: Math.max(18, (b / maxVal) * 100),
      };
    }

    return (
      <details className={styles.details} style={{ marginTop: 14 }}>
        <summary className={styles.summary}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Trophy size={18} /> Head-to-head
          </span>
          <span className={styles.summaryRight}>
            Compare <ChevronDown size={16} />
          </span>
        </summary>

        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 10,
              alignItems: "center",
              padding: "4px 2px 14px",
              borderBottom: "1px solid var(--stroke)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--muted)", marginBottom: 4 }}>Home</div>
              <div style={{ fontWeight: 950, fontSize: 16, lineHeight: 1.15 }}>{teamDisplayLabel(homeTeam)}</div>
            </div>

            <div
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: "1px solid var(--stroke)",
                background: "rgba(17,24,39,0.03)",
                fontSize: 12,
                fontWeight: 950,
                color: "var(--muted)",
              }}
            >
              vs
            </div>

            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--muted)", marginBottom: 4 }}>Away</div>
              <div style={{ fontWeight: 950, fontSize: 16, lineHeight: 1.15 }}>{teamDisplayLabel(awayTeam)}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {metrics.map((m) => {
              const homeBetter = isHomeBetter(m);
              const awayBetter = isAwayBetter(m);
              const { homePct, awayPct } = getStrengths(m);

              const homeValue = m.format ? m.format(m.home) : String(m.home);
              const awayValue = m.format ? m.format(m.away) : String(m.away);

              return (
                <div
                  key={m.key}
                  style={{
                    border: "1px solid var(--stroke)",
                    borderRadius: 16,
                    padding: 12,
                    background:
                      homeBetter || awayBetter
                        ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)"
                        : "rgba(255,255,255,0.9)",
                    boxShadow: "0 8px 22px rgba(17,24,39,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 950,
                      fontSize: 12,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      marginBottom: 10,
                    }}
                  >
                    {m.label}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 58,
                        textAlign: "left",
                        fontWeight: 950,
                        fontSize: 18,
                        color: homeBetter ? "rgb(21,128,61)" : "var(--text)",
                      }}
                    >
                      {homeValue}
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div
                          style={{
                            position: "relative",
                            height: 12,
                            borderRadius: 999,
                            background: "rgba(17,24,39,0.06)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: `${homePct}%`,
                              borderRadius: 999,
                              background: homeBetter
                                ? "linear-gradient(90deg, rgba(34,197,94,0.38), rgba(34,197,94,0.88))"
                                : "linear-gradient(90deg, rgba(148,163,184,0.28), rgba(148,163,184,0.62))",
                            }}
                          />
                        </div>

                        <div
                          style={{
                            position: "relative",
                            height: 12,
                            borderRadius: 999,
                            background: "rgba(17,24,39,0.06)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${awayPct}%`,
                              borderRadius: 999,
                              background: awayBetter
                                ? "linear-gradient(90deg, rgba(59,130,246,0.88), rgba(59,130,246,0.38))"
                                : "linear-gradient(90deg, rgba(148,163,184,0.62), rgba(148,163,184,0.28))",
                            }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          fontSize: 11,
                          fontWeight: 900,
                          color: "var(--muted)",
                        }}
                      >
                        <div>Home</div>
                        <div style={{ textAlign: "right" }}>Away</div>
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: 58,
                        textAlign: "right",
                        fontWeight: 950,
                        fontSize: 18,
                        color: awayBetter ? "rgb(29,78,216)" : "var(--text)",
                      }}
                    >
                      {awayValue}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    );
  }

  const upcomingPreview = upcoming.slice(0, 4);
  const upcomingList = showAllUpcoming ? upcoming : upcomingPreview;

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <div className={styles.h1}>Briars Fixtures</div>
          <div className={styles.sub}>
            Source: <span className={styles.strong}>Sydney Men’s Hockey</span>
            {data?.refreshedAt ? ` • Refreshed ${new Date(data.refreshedAt).toLocaleString("en-AU")}` : ""}
          </div>
        </div>

        <div className={styles.actions}>
          {toast ? <div className={styles.toast}>{toast}</div> : null}
          {pinOk ? (
            <Button kind="soft" onClick={logout}>
              <LogOut size={16} /> Log out
            </Button>
          ) : null}
        </div>
      </div>

      {!loginComplete ? (
        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 16 }}>
          <div className={styles.sectionTitle}>Team access</div>
          <div className={styles.loginGrid} style={{ marginTop: 12 }}>
            <div>
              <div className={styles.label}>Team PIN</div>
              <div className={styles.pinRow}>
                <input
                  className={styles.input}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter team PIN"
                />
                <Button onClick={rememberPin}>
                  <ShieldCheck size={16} /> Save PIN
                </Button>
              </div>
            </div>

            <div>
              <div className={styles.label}>Your name</div>
              <input
                className={styles.input}
                value={playerName}
                onChange={(e) => persistName(e.target.value)}
                placeholder="e.g. Joel"
              />
              <div className={styles.hint}>Needed so everyone can see who’s in / out / maybe.</div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <div className={`${styles.card} ${styles.cardPad}`}>Loading fixtures…</div> : null}

      {!loading && nextGame ? (
        <div className={`${styles.card} ${styles.cardPad} ${styles.nextGameCard}`}>
          <div className={styles.rowTop}>
            <Pill tone="gold">
              <Trophy size={16} /> Next game
            </Pill>

            <Pill tone="blue">
              Starts in <b style={{ color: "var(--text)" }}>{formatCountdown(new Date(nextGame.kickoffISO).getTime() - now.getTime())}</b>
            </Pill>
          </div>

          <div className={styles.vsGrid}>
            <div className={styles.team}>
              <Logo url={CLUB_LOGOS[clubKey(nextGame.home)]} />
              <div>
                <div className={styles.teamName}>{nextGame.home}</div>
                <div className={styles.subMini}>Home</div>
              </div>
            </div>

            <div className={styles.mid}>
              <div className={styles.vs}>VS</div>
              <div className={styles.subMini}>{nextGame.roundLabel || "Upcoming fixture"}</div>
            </div>

            <div className={`${styles.team} ${styles.teamRight}`}>
              <div>
                <div className={styles.teamName}>{nextGame.away}</div>
                <div className={styles.subMini}>Away</div>
              </div>
              <Logo url={CLUB_LOGOS[clubKey(nextGame.away)]} />
            </div>
          </div>

          <div className={styles.chips}>
            <Pill tone="blue">
              <CalendarDays size={16} /> {formatDayDateFromSource(nextGame.date)}
            </Pill>
            <Pill tone="green">
              <Clock3 size={16} /> {formatTimeFromSource(nextGame.time)}
            </Pill>
            <Pill tone="map">
              <MapPin size={16} /> {nextGame.venue || "—"}
            </Pill>
          </div>

          {weather?.ok ? (
            <div className={styles.weatherRow}>
              <Pill subtle>
                <CloudSun size={15} /> {typeof weather.tempC === "number" ? `${weather.tempC}°C` : "—"}
              </Pill>
              <Pill subtle>
                <Droplets size={15} /> {typeof weather.precipMM === "number" ? `${weather.precipMM}mm` : "—"}
              </Pill>
              <Pill subtle>
                <Wind size={15} /> {typeof weather.windKmh === "number" ? `${weather.windKmh}km/h` : "—"}
              </Pill>
            </div>
          ) : null}

          <HeadToHead homeTeam={nextGame.home} awayTeam={nextGame.away} />

          <div className={styles.divider} />

          <AvailabilityBlock g={nextGame} />
        </div>
      ) : null}

      {!loading && upcoming.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div className={styles.sectionTop}>
            <div className={styles.sectionTitle}>Upcoming fixtures</div>

            <button className={styles.pillBtn} type="button" onClick={() => setShowAllUpcoming((v) => !v)}>
              {showAllUpcoming ? (
                <>
                  Show next 4 <ChevronUp size={16} />
                </>
              ) : (
                <>
                  Show all <ChevronDown size={16} />
                </>
              )}
            </button>
          </div>

          <div className={styles.grid}>
            {upcomingList.map((g) => {
              const key = makeSourceKey(g);
              const counts = countsByKey[key] || { yes: 0, maybe: 0, no: 0 };
              const ms = new Date(g.kickoffISO).getTime() - now.getTime();

              return (
                <div key={key} className={styles.gcard}>
                  <div className={styles.gTop}>
                    <div className={styles.gMatch}>
                      <Logo url={CLUB_LOGOS[clubKey(g.home)]} />
                      <div className={styles.gVs}>vs</div>
                      <Logo url={CLUB_LOGOS[clubKey(g.away)]} />
                    </div>

                    <Pill tone="blue">{formatCountdown(ms)}</Pill>
                  </div>

                  <div className={styles.gNames}>
                    <div className={styles.gTitle}>
                      {shortTeamName(g.home)} v {shortTeamName(g.away)}
                    </div>
                    <div className={styles.gSub}>{g.roundLabel || "Fixture"}</div>
                  </div>

                  <div className={styles.gMeta}>
                    <span className={styles.gMetaItem}>
                      <CalendarDays size={14} /> {formatDayDateFromSource(g.date)}
                    </span>
                    <span className={styles.gMetaItem}>
                      <Clock3 size={14} /> {formatTimeFromSource(g.time)}
                    </span>
                    <span className={styles.gMetaItem}>
                      <MapPin size={14} /> {g.venue || "—"}
                    </span>
                  </div>

                  <AvailabilityBlock g={g} />

                  <div style={{ marginTop: 12 }}>
                    <Pill tone="gold">
                      <Users size={15} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}
                    </Pill>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && ladderHeaders.length > 0 && sortedLadderRows.length > 0 ? (
        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginTop: 18 }}>
          <div className={styles.sectionTitle}>Ladder</div>

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
                {sortedLadderRows.map((row, idx) => {
                  const isBriars = String(row.team).toLowerCase().includes("briars");
                  return (
                    <tr key={`${row.team}-${idx}`} className={isBriars ? styles.ladderBriars : ""}>
                      {row.cols.map((cell, i) => (
                        <td key={`${idx}-${i}`} className={styles.ladderTd}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && past.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div className={styles.sectionTop}>
            <div className={styles.sectionTitle}>Past results</div>
          </div>

          <div className={styles.pastGrid}>
            {past.slice(0, 8).map((g) => (
              <div key={makeSourceKey(g)} className={styles.gcard}>
                <div className={styles.gTitle}>
                  {shortTeamName(g.home)} v {shortTeamName(g.away)}
                </div>
                <div className={styles.gSub}>{formatLongDateFromSource(g.date)}</div>

                <div className={styles.gMeta}>
                  <span className={styles.gMetaItem}>
                    <Clock3 size={14} /> {formatTimeFromSource(g.time)}
                  </span>
                  <span className={styles.gMetaItem}>
                    <MapPin size={14} /> {g.venue || "—"}
                  </span>
                  <span className={styles.gMetaItem}>
                    <Trophy size={14} /> {g.score || "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
