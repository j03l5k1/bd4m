"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./briars.module.css";

import HeaderBar from "./components/HeaderBar";
import HeroMatch from "./components/HeroMatch";
import LadderTable from "./components/LadderTable";

export type Game = {
  date: string;
  time: string;
  venue: string;
  roundLabel: string;
  home: string;
  away: string;
  score: string;
  kickoffISO: string;
};

export type LadderPayload = {
  headers: string[];
  rows: { team: string; cols: string[] }[];
};

export type Payload = {
  ok: boolean;
  team: string;
  source: string;
  refreshedAt: string;
  games: Game[];
  // full competition dataset (all teams) from the scraper
  allGames?: Game[];
  ladder?: LadderPayload;
};

export type Counts = { yes: number; no: number; maybe: number };
export type NamesByStatus = { yes: string[]; maybe: string[]; no: string[] };

export type Weather = {
  ok: boolean;
  at?: string;
  tempC?: number;
  precipMM?: number;
  windKmh?: number;
  location?: string;
};

const LS_PIN_OK = "briars_pin_ok";
const LS_TEAM_PIN = "briars_team_pin";

function makeSourceKey(g: Game) {
  return `${g.date}|${g.time}|${g.home}|${g.away}|${g.venue}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toICSUTC(dt: Date) {
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(
    dt.getUTCMinutes()
  )}${pad(dt.getUTCSeconds())}Z`;
}
function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function buildAllGamesICS(games: Game[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Briars Fixtures//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];

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

export default function BriarsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState<string | null>(null);

  const [pinOk, setPinOk] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [userPinnedSelection, setUserPinnedSelection] = useState(false);
  const [showAllFixtureTabs, setShowAllFixtureTabs] = useState(false);

  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
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

  function flash(msg: string, ms = 1800) {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  }

  function logout() {
    localStorage.removeItem(LS_PIN_OK);
    localStorage.removeItem(LS_TEAM_PIN);
    setPinOk(false);
    flash("Logged out", 1600);
  }

  const gamesSorted = useMemo(() => {
    const games = data?.games ?? [];
    return [...games].sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());
  }, [data]);

  const nextUpcomingIndex = useMemo(() => {
    const t = now.getTime();
    const idx = gamesSorted.findIndex((g) => new Date(g.kickoffISO).getTime() >= t);
    return idx === -1 ? Math.max(gamesSorted.length - 1, 0) : idx;
  }, [gamesSorted, now]);

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

  if (loading) return <div className={styles.shell}>Loading…</div>;
  if (!data) return <div className={styles.shell}>Could not load fixtures.</div>;
  if (!activeGame) return <div className={styles.shell}>No games found.</div>;

  return (
    <div className={styles.shell}>
      <HeaderBar data={data} toast={toast} pinOk={pinOk} onLogout={logout} onDownloadCalendar={() => downloadICS(data.games)} />

      <HeroMatch
        activeGame={activeGame}
        gamesSorted={gamesSorted}
        allGames={data.allGames ?? gamesSorted}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        setUserPinnedSelection={setUserPinnedSelection}
        upcomingGames={upcomingGames}
        showAllFixtureTabs={showAllFixtureTabs}
        setShowAllFixtureTabs={setShowAllFixtureTabs}
        now={now}
        weather={weather}
        isActiveUpcoming={isActiveUpcoming}
        onToast={(m) => flash(m)}
        ladder={data.ladder}
      />

      <LadderTable ladder={data.ladder} />
    </div>
  );
}
