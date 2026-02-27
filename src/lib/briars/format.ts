import type { Game } from "./types";
import { DEFAULT_TIMEZONE } from "./constants";

export function formatSydneyDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    timeZone: DEFAULT_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatSydneyShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    timeZone: DEFAULT_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatSydneyTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", {
    timeZone: DEFAULT_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function buildSourceKey(game: Pick<Game, "date" | "time" | "home" | "away" | "venue">) {
  return `${game.date}|${game.time}|${game.home}|${game.away}|${game.venue}`;
}

export function buildLegacySourceKey(game: Pick<Game, "kickoffISO" | "home" | "away">) {
  return `${game.kickoffISO}|${game.home}|${game.away}`;
}

export function normaliseName(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function teamMatchesLabel(teamName: string, needle: string) {
  return normaliseName(teamName).includes(normaliseName(needle));
}

export function parseScore(score: string): { a: number; b: number } | null {
  const cleaned = String(score || "")
    .replace(/[^\d\-–: ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const m = cleaned.match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  return { a, b };
}

export function isPlayedGame(game: Game) {
  return game.score !== "-" && game.score.trim() !== "";
}

export function isUpcomingGame(game: Game) {
  return new Date(game.kickoffISO).getTime() > Date.now();
}

export function sortGamesByKickoffAsc(games: Game[]) {
  return [...games].sort(
    (a, b) =>
      new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
  );
}

export function getActiveGame(games: Game[]) {
  const sorted = sortGamesByKickoffAsc(games);
  const upcoming = sorted.find(isUpcomingGame);
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}
