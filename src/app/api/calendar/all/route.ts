import { NextResponse } from "next/server";

type Game = {
  roundLabel: string;
  home: string;
  away: string;
  venue: string;
  kickoffISO: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toICSLocal(dt: Date) {
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  return `${y}${m}${d}T${hh}${mm}00`;
}

function escapeICS(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function uidFor(g: Game) {
  // stable-ish UID across imports
  const base = `${g.kickoffISO}|${g.home}|${g.away}`.replace(/[^a-zA-Z0-9]/g, "");
  return `${base}@bd4m`;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const res = await fetch(`${origin}/api/briars-fixtures`, { cache: "no-store" });
  const json = await res.json();

  const games: Game[] = json?.games || [];

  const durationMins = 90;
  const nowStamp = toICSLocal(new Date());

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Briars Legends//Fixtures//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:Briars Legends");
  lines.push("X-WR-TIMEZONE:Australia/Sydney");

  for (const g of games) {
    const start = new Date(g.kickoffISO);
    const end = new Date(start.getTime() + durationMins * 60 * 1000);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uidFor(g)}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;TZID=Australia/Sydney:${toICSLocal(start)}`);
    lines.push(`DTEND;TZID=Australia/Sydney:${toICSLocal(end)}`);
    lines.push(`SUMMARY:${escapeICS(`${g.home} vs ${g.away}`)}`);
    lines.push(`LOCATION:${escapeICS(g.venue || "SMHA Legends")}`);
    lines.push(`DESCRIPTION:${escapeICS(`Round: ${g.roundLabel || "—"}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="briars-legends.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
