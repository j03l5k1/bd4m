"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./briars.module.css";

import HeaderBar from "./components/HeaderBar";
import HeroMatch from "./components/HeroMatch";
import LadderTable from "./components/LadderTable";

import { LS_PIN_OK, LS_TEAM_PIN } from "../../lib/briars/constants";
import { downloadICS, getNextUpcomingIndex, sortGamesByKickoffAsc } from "../../lib/briars/format";
import type {
  Counts,
  Game,
  LadderPayload,
  NamesByStatus,
  Payload,
  Weather,
} from "../../lib/briars/types";

/**
 * Temporary compatibility re-exports:
 * Existing components still import these types from ../page
 * so this keeps the current app working while we refactor block-by-block.
 */
export type { Counts, Game, LadderPayload, NamesByStatus, Payload, Weather };

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
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/briars-fixtures", { cache: "no-store" });
        const text = await res.text();
        let json: Payload | null = null;
        try {
          json = JSON.parse(text) as Payload;
        } catch {
          json = null;
        }

        if (!res.ok) {
          setData({
            ok: false,
            team: "Briars",
            source: "api",
            refreshedAt: new Date().toISOString(),
            games: [],
            error: json?.error || `HTTP ${res.status}: ${res.statusText || "Request failed"}`,
          });
          return;
        }

        if (!json) {
          setData({
            ok: false,
            team: "Briars",
            source: "api",
            refreshedAt: new Date().toISOString(),
            games: [],
            error: "API returned invalid JSON",
          });
          return;
        }

        setData(json);
      } catch {
        setData({
          ok: false,
          team: "Briars",
          source: "api",
          refreshedAt: new Date().toISOString(),
          games: [],
          error: "Network error calling /api/briars-fixtures",
        });
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
    return sortGamesByKickoffAsc(games);
  }, [data]);

  const nextUpcomingIndex = useMemo(() => {
    return getNextUpcomingIndex(gamesSorted, now);
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

  useEffect(() => {
    const current = Date.now();
    const futureKickoffs = gamesSorted
      .map((g) => new Date(g.kickoffISO).getTime())
      .filter((ts) => Number.isFinite(ts) && ts > current)
      .sort((a, b) => a - b);

    let delayMs: number;
    if (futureKickoffs.length) {
      // Re-evaluate shortly after the next kickoff passes.
      delayMs = Math.max(futureKickoffs[0] - current + 60_000, 60_000);
    } else {
      // No future fixtures loaded: check once per day.
      delayMs = 24 * 60 * 60 * 1000;
    }

    const timeout = setTimeout(() => setNow(new Date()), Math.min(delayMs, 2_147_483_647));
    return () => clearTimeout(timeout);
  }, [gamesSorted, now]);

  useEffect(() => {
    (async () => {
      if (!activeGame || !isActiveUpcoming) {
        setWeather(null);
        setWeatherLoading(false);
        return;
      }

      setWeatherLoading(true);
      try {
        const res = await fetch(
          `/api/weather/homebush?kickoffISO=${encodeURIComponent(activeGame.kickoffISO)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as Weather;
        setWeather(json);
      } catch {
        setWeather(null);
      } finally {
        setWeatherLoading(false);
      }
    })();
  }, [activeGame?.kickoffISO, isActiveUpcoming]);

  if (loading) return <div className={styles.shell}>Loading…</div>;
  if (!data) return <div className={styles.shell}>Could not load fixtures.</div>;
  if (data.ok === false) {
    return (
      <div className={styles.shell}>
        {data.error || "Could not load fixtures."}
      </div>
    );
  }
  if (!activeGame) return <div className={styles.shell}>No games found.</div>;

  return (
    <div className={styles.shell}>
      <HeaderBar
        data={data}
        toast={toast}
        pinOk={pinOk}
        onLogout={logout}
        onDownloadCalendar={() => downloadICS(data.games)}
      />

      <HeroMatch
        activeGame={activeGame}
        gamesSorted={gamesSorted}
        allGames={data.allGames ?? gamesSorted}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        setUserPinnedSelection={setUserPinnedSelection}
        showAllFixtureTabs={showAllFixtureTabs}
        setShowAllFixtureTabs={setShowAllFixtureTabs}
        weather={weather}
        weatherLoading={weatherLoading}
        isActiveUpcoming={isActiveUpcoming}
        onToast={(m) => flash(m)}
        ladder={data.ladder}
      />

      <LadderTable ladder={data.ladder} />
    </div>
  );
}
