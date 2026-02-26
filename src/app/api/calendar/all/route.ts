import { NextResponse } from "next/server";

type Game = {
  roundLabel: string;
  home: string;
  away: string;
  venue: string;
  kickoffISO: string;
};

function escapeICS(s: string) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function uidFor(g: Game) {
  const base = `${g.kickoffISO}|${g.home}|${g.away}`.replace(/[^a-zA-Z0-9]/g, "");
  return `${base}@bd4m`;
}

function toICSDateTimeInSydney(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  return `${map.year}${map.month}${map.day}T${map.hour}${map.minute}${map.second}`;
}

function toICSUtcStamp(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const res = await fetch(`${origin}/api/briars-fixtures`, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Failed to load fixtures" }, { status: 502 });
  }

  const json = await res.json();
  const games: Game[] = Array.isArray(json?.games) ? json.games : [];

  const durationMins = 90;
  const nowStamp = toICSUtcStamp(new Date());

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
    if (Number.isNaN(start.getTime())) continue;

    const end = new Date(start.getTime() + durationMins * 60 * 1000);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uidFor(g)}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;TZID=Australia/Sydney:${toICSDateTimeInSydney(start)}`);
    lines.push(`DTEND;TZID=Australia/Sydney:${toICSDateTimeInSydney(end)}`);
    lines.push(`SUMMARY:${escapeICS(`${g.home} vs ${g.away}`)}`);
    lines.push(`LOCATION:${escapeICS("Sydney Olympic Park Hockey Centre")}`);
    lines.push(
  `DESCRIPTION:${escapeICS(`Round: ${g.roundLabel || "—"}\\nVenue: Sydney Olympic Park Hockey Centre\\nMap: https://maps.app.goo.gl/YE4bD7YUjN9jacNH7`)}`
);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="briars-legends.ics"',
      "Cache-Control": "no-store",
    },
  });
}
