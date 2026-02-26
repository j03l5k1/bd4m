import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

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

type LadderRow = {
  team: string;
  cols: string[];
};

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return Math.round((asUTC - date.getTime()) / 60000);
}

function parseKickoffISO(date: string, time: string) {
  const [dd, mm, yyyy] = date.split("/").map(Number);
  const [hh = 0, min = 0, sec = 0] = (time || "00:00:00").split(":").map(Number);

  // Treat scraped values as local Australia/Sydney time.
  const utcGuess = Date.UTC(yyyy, (mm || 1) - 1, dd || 1, hh, min, sec);
  const guessDate = new Date(utcGuess);
  const offsetMinutes = getTimeZoneOffsetMinutes(guessDate, "Australia/Sydney");
  const actualUtcMs = utcGuess - offsetMinutes * 60_000;

  return new Date(actualUtcMs).toISOString();
}

export async function GET() {
  const url = "https://smhockey.com.au/legends";

  const res = await fetch(url, { next: { revalidate: 43200 } });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Failed to fetch source" }, { status: 502 });
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  let currentRound = "";
  const allGames: Game[] = [];
  const briarsGames: Game[] = [];

  $("tr").each((_, tr) => {
    const rowText = clean($(tr).text());
    const roundMatch = rowText.match(/\bRound\s+\d+\b/i);
    if (roundMatch) currentRound = roundMatch[0];

    const tds = $(tr).find("td");
    if (tds.length < 6) return;

    const date = clean($(tds[0]).text());
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return;

    const home = clean($(tds[1]).text());
    const away = clean($(tds[2]).text());
    const time = clean($(tds[3]).text()) || "00:00:00";
    const venue = clean($(tds[4]).text());
    const score = clean($(tds[5]).text()) || "-";

    const game: Game = {
      date,
      time,
      venue,
      roundLabel: currentRound || "",
      home,
      away,
      score,
      kickoffISO: parseKickoffISO(date, time),
    };

    allGames.push(game);

    const isBriars = /briars/i.test(home) || /briars/i.test(away);
    if (isBriars) briarsGames.push(game);
  });

  allGames.sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());
  briarsGames.sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());

  let ladderHeaders: string[] = [];
  const ladderRows: LadderRow[] = [];

  $("table").each((_, table) => {
    const headers = $(table)
      .find("tr")
      .first()
      .find("th,td")
      .map((_, cell) => clean($(cell).text()))
      .get()
      .filter(Boolean);

    const looksLikeLadder =
      headers.some((h) => /^team$/i.test(h)) &&
      headers.some((h) => /pts|points/i.test(h));

    if (!looksLikeLadder) return;

    ladderHeaders = headers;

    $(table)
      .find("tr")
      .slice(1)
      .each((_, tr) => {
        const cells = $(tr)
          .find("td,th")
          .map((_, cell) => clean($(cell).text()))
          .get()
          .filter((x) => x !== "");

        if (cells.length < 2) return;
        ladderRows.push({ team: cells[0], cols: cells });
      });

    return false;
  });

  return NextResponse.json({
    ok: true,
    team: "Briars",
    source: url,
    refreshedAt: new Date().toISOString(),
    // fixtures to show on the Briars page
    games: briarsGames,
    // full comp dataset so we can compute opponent form / h2h without breaking on UI truncation
    allGames,
    ladder: {
      headers: ladderHeaders,
      rows: ladderRows,
    },
  });
}
