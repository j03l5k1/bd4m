import { NextResponse } from "next/server";

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toICSLocal(dt: Date) {
  // Floating local time (no Z). We also set TZID=Australia/Sydney.
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  const ss = "00";
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

function escapeICS(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  // Pull fixtures from your own API (cached scrape)
  const res = await fetch(`${origin}/api/briars-fixtures`, { cache: "no-store" });
  const json = await res.json();

  const games: Game[] = (json?.games || []) as Game[];

  // Only upcoming
  const now = Date.now();
  const upcoming = games.filter((g) => new Date(g.kickoffISO).getTime() >= now);

  // Default game length (mins)
  const durationMins = 90;

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Briars Legends//Fixtures//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:Briars Legends");
  lines.push("X-WR-TIMEZONE:Australia/Sydney");

  // Simple timezone declaration (many clients accept TZID without full VTIMEZONE)
  // Keeps this lightweight and broadly compatible.
  // If you ever want full DST-correct VTIMEZONE, we can add it.
  for (const g of upcoming) {
    const start = new Date(g.kickoffISO);
    const end = new Date(start.getTime() + durationMins * 60 * 1000);

    const uid = `${encodeICSUid(g.kickoffISO)}-${hashish(g.home + g.away)}@bd4m`;
    const summary = `${g.home} vs ${g.away}`;
    const location = g.venue ? `${g.venue}` : "SMHA Legends";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toICSLocal(new Date())}`);
    lines.push(`DTSTART;TZID=Australia/Sydney:${toICSLocal(start)}`);
    lines.push(`DTEND;TZID=Australia/Sydney:${toICSLocal(end)}`);
    lines.push(`SUMMARY:${escapeICS(summary)}`);
    lines.push(`LOCATION:${escapeICS(location)}`);
    lines.push(`DESCRIPTION:${escapeICS(`Round: ${g.roundLabel || "—"}\\nSource: ${json?.source || ""}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="briars-legends.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

// Helpers: keep UID stable-ish
function encodeICSUid(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "");
}
function hashish(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h);
}
