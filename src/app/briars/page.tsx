"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  CloudSun,
  Droplets,
  LogOut,
  MapPin,
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
}: {
  children: React.ReactNode;
  tone?: "default" | "gold" | "blue" | "green" | "soft";
}) {
  const toneClass =
    tone === "gold"
      ? styles.pillGold
      : tone === "blue"
      ? styles.pillBlue
      : tone === "green"
      ? styles.pillGreen
      : tone === "soft"
      ? styles.pillSoft
      : "";
  return <span className={`${styles.pill} ${toneClass}`}>{children}</span>;
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

  // single index over ALL games (past + future) to support prev/next browsing
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // if user has manually selected a game, we stop auto-jumping
  const [userPinnedSelection, setUserPinnedSelection] = useState(false);

  const [weather, setWeather] = useState<Weather | null>(null);
  const [showAllFixtureTabs, setShowAllFixtureTabs] = useState(false);

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

  const gamesSorted = useMemo(() => {
    const games = data?.games ?? [];
    return [...games].sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());
  }, [data]);

  const nextUpcomingIndex = useMemo(() => {
    const t = now.getTime();
    const idx = gamesSorted.findIndex((g) => new Date(g.kickoffISO).getTime() >= t);
    return idx === -1 ? Math.max(gamesSorted.length - 1, 0) : idx;
  }, [gamesSorted, now]);

  // Default selection:
  // - first time we load, jump to next upcoming
  // - after games pass (midnight / post-game), auto jump again IF user has not pinned selection
  useEffect(() => {
    if (!gamesSorted.length) return;

    setActiveIndex((prev) => {
      const safePrev = Math.min(Math.max(prev, 0), gamesSorted.length - 1);
      if (userPinnedSelection) return safePrev;
      return nextUpcomingIndex;
    });
  }, [gamesSorted.length, nextUpcomingIndex, userPinnedSelection]);

  const activeGame = gamesSorted[activeIndex] || null;

  const isActiveUpcoming = useMemo(() => {
    if (!activeGame) return false;
    return new Date(activeGame.kickoffISO).getTime() >= now.getTime();
  }, [activeGame, now]);

  const upcomingGames = useMemo(() => {
    const t = now.getTime();
    return gamesSorted.filter((g) => new Date(g.kickoffISO).getTime() >= t);
  }, [gamesSorted, now]);

  const pastGames = useMemo(() => {
    const t = now.getTime();
    return gamesSorted.filter((g) => new Date(g.kickoffISO).getTime() < t).sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime());
  }, [gamesSorted, now]);

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
        ? { yes: mergedNames.yes.length, maybe: mergedNames.maybe.length, no: mergedNames.no.length }
        : mergeCounts(stableCounts, legacyCounts);

    setNamesByKey((prev) => ({ ...prev, [stableKey]: mergedNames }));
    setCountsByKey((prev) => ({ ...prev, [stableKey]: mergedCounts }));

    const mine = statusFromNames(mergedNames, playerName);
    if (mine) setMyStatusByKey((prev) => ({ ...prev, [stableKey]: mine }));
  }

  // Preload a chunk (so future tabs are ready)
  useEffect(() => {
    (async () => {
      for (const g of upcomingGames.slice(0, 20)) {
        await loadAvailabilityForGame(g);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingGames.length]);

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
      if (!activeGame || !isActiveUpcoming) {
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
  }, [activeGame?.kickoffISO, isActiveUpcoming]);

  function flash(msg: string, ms = 1800) {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  }

  function persistName(next: string) {
    setPlayerName(next);
    const n = next.trim();
    if (n.length >= 2) localStorage.setItem(LS_PLAYER_NAME, n);
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

  function selectGameByIndex(idx: number) {
    const safe = Math.min(Math.max(idx, 0), Math.max(gamesSorted.length - 1, 0));
    setUserPinnedSelection(true);
    setActiveIndex(safe);
  }

  function goPrev() {
    selectGameByIndex(activeIndex - 1);
  }
  function goNext() {
    selectGameByIndex(activeIndex + 1);
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
              {mine === "yes"
                ? "You’re in"
                : mine === "maybe"
                ? "You’re maybe"
                : mine === "no"
                ? "You’re out"
                : "Set your status"}
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

  if (loading) return <div className={styles.shell}>Loading…</div>;
  if (!data) return <div className={styles.shell}>Could not load fixtures.</div>;

  const heroCountdown = activeGame ? formatCountdown(new Date(activeGame.kickoffISO).getTime() - now.getTime()) : "";

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
                <Pill tone="gold">{activeGame.roundLabel || "Round"}</Pill>
                <Pill tone="blue">{heroCountdown}</Pill>
                {!isActiveUpcoming ? <Pill tone="soft">Final</Pill> : null}
              </div>

              <div className={styles.heroNav}>
                <Button kind="soft" onClick={goPrev} disabled={activeIndex <= 0}>
                  <ChevronLeft size={16} /> Prior
                </Button>
                <Button kind="soft" onClick={goNext} disabled={activeIndex >= gamesSorted.length - 1}>
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            {/* Switchable fixture tabs (upcoming focus) */}
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
                    type="button"
                    onClick={() => {
                      setUserPinnedSelection(true);
                      setShowAllFixtureTabs((v) => !v);
                    }}
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

            {/* Mobile-aligned matchup block */}
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

              {!isActiveUpcoming && activeGame.score ? (
                <div className={styles.resultPill}>Result: {activeGame.score}</div>
              ) : null}
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
          </div>
        </section>
      ) : null}

      {/* Upcoming fixtures: collapsible, default collapsed */}
      <section className={styles.section}>
        <details className={styles.details}>
          <summary className={styles.summary}>
            <span>Upcoming fixtures</span>
            <span className={styles.summaryRight}>
              {upcomingGames.length} games <ChevronDown size={16} />
            </span>
          </summary>
          <div className={styles.detailsBody}>
            <div className={styles.upcomingList}>
              {upcomingGames.map((g) => {
                const key = makeSourceKey(g);
                const counts = countsByKey[key] || { yes: 0, maybe: 0, no: 0 };
                const mine = myStatusByKey[key];
                const isActive = activeGame && makeSourceKey(activeGame) === key;

                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.fixtureRow} ${isActive ? styles.fixtureRowActive : ""}`}
                    onClick={() => {
                      setUserPinnedSelection(true);
                      const idx = gamesSorted.findIndex((x) => makeSourceKey(x) === key);
                      if (idx >= 0) setActiveIndex(idx);
                    }}
                  >
                    <div className={styles.fixtureRowMain}>
                      <div className={styles.fixtureRowTitle}>
                        {g.roundLabel ? `${g.roundLabel} • ` : ""}
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

            <div className={styles.hint}>
              Tip: tap a fixture to load it into the hero, then set your availability.
            </div>
          </div>
        </details>
      </section>

      {/* Ladder + Past Results remain as you had them (keep your existing ladder/past blocks if already present) */}
      {/* If you want me to merge your exact ladder + past markup back in here, paste your current ladder/past blocks. */}
    </div>
  );
}
