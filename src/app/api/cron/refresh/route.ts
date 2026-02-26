import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import * as cheerio from "cheerio";

type Game = {
  date: string;      // dd/mm/yyyy
  time: string;      // HH:MM:SS
  venue: string;
  roundLabel: string;
  home: string;
  away: string;
  score: string;
  kickoffISO: string; // ISO string for easy sorting + countdown
};

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function parseKickoffISO(date: string, time: string) {
  const [dd, mm, yyyy] = date.split("/");
  const t = time && time.length >= 5 ? time : "00:00:00";
  return new Date(`${yyyy}-${mm}-${dd}T${t}`).toISOString();
}

export async function GET() {
  const url = "https://smhockey.com.au/legends";

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Failed to fetch source" }, { status: 502 });
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  let currentRound = "";
  const games: Game[] = [];

  $("tr").each((_, tr) => {
    // round headings are in various elements; easiest is to detect "Round X" when it appears in the row text
    const rowText = clean($(tr).text());
    const roundMatch = rowText.match(/\bRound\s+\d+\b/i);
    if (roundMatch) currentRound = roundMatch[0];

    const tds = $(tr).find("td");
    if (tds.length < 6) return;

    const date = clean($(tds[0]).text());
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return;

    const home = clean($(tds[1]).text());
    const away = clean($(tds[2]).text());
    const time = clean($(tds[3]).text());
    const venue = clean($(tds[4]).text());
    const score = clean($(tds[5]).text());

    const isBriars = /briars/i.test(home) || /briars/i.test(away);
    if (!isBriars) return;

    const kickoffISO = parseKickoffISO(date, time);

    games.push({
      date,
      time,
      venue,
      roundLabel: currentRound || "",
      home,
      away,
      score: score || "-",
      kickoffISO
    });
  });

  games.sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());

  const payload = {
    ok: true,
    team: "Briars",
    source: url,
    refreshedAt: new Date().toISOString(),
    games
  };

  // Store for fast reads
  await kv.set("briars:fixtures", payload);

  return NextResponse.json(payload);
}
