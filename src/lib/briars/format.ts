import type { Game } from "./types";
import { DEFAULT_TIMEZONE } from "./constants";

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function buildSourceKey(g: Pick<Game, "date" | "time" | "home" | "away" | "venue">) {
  return `${g.date}|${g.time}|${g.home}|${g.away}|${g.venue}`;
}

export function buildLegacySourceKey(g: Pick<Game, "kickoffISO" | "home" | "away">) {
  return `${g.kickoffISO}|${g.home}|${g.away}`;
}

export function parseSourceDate(dateStr: string) {
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1);
}

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

export function formatDayDateFromSource(dateStr: string) {
  const d = parseSourceDate(dateStr);
  const day = d.toLocaleDateString("en-AU", { weekday: "short" });
  const [dd, mm] = dateStr.split("/");
  return `${day} ${dd}/${mm}`;
}

export function formatLongDateFromSource(dateStr: string) {
  const d = parseSourceDate(dateStr);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatTimeFromSource(timeStr: string) {
  const [hour24 = 0, minute = 0] = timeStr.split(":").map(Number);
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function normaliseName(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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
  return game.score !== "-" && String(game.score || "").trim() !== "";
}

export function isUpcomingGame(game: Game, now = new Date()) {
  return new Date(game.kickoffISO).getTime() >= now.getTime();
}

export function sortGamesByKickoffAsc(games: Game[]) {
  return [...games].sort(
    (a, b) =>
      new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
  );
}

export function getNextUpcomingIndex(games: Game[], now = new Date()) {
  const t = now.getTime();
  const idx = games.findIndex((g) => new Date(g.kickoffISO).getTime() >= t);
  return idx === -1 ? Math.max(games.length - 1, 0) : idx;
}

export function toICSUTC(dt: Date) {
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(
    dt.getUTCDate()
  )}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(
    dt.getUTCSeconds()
  )}Z`;
}

export function escapeICS(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildAllGamesICS(games: Game[]) {
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
    const uid = `${buildSourceKey(g).replace(/[^\w]/g, "")}@briarsfixtures`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toICSUTC(new Date())}`);
    lines.push(`DTSTART:${toICSUTC(start)}`);
    lines.push(`DTEND:${toICSUTC(end)}`);
    lines.push(`SUMMARY:${escapeICS(`${g.home} vs ${g.away}`)}`);
    lines.push(
      `DESCRIPTION:${escapeICS(`${g.roundLabel} • ${g.home} vs ${g.away}`)}`
    );
    lines.push(`LOCATION:${escapeICS(g.venue)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(games: Game[]) {
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
