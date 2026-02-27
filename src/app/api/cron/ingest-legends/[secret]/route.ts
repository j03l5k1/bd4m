import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function clean(s: string) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}
function norm(s: string) {
  return clean(s).toLowerCase();
}
function teamKeyFromName(name: string) {
  return norm(name);
}

function parseScore(score: string): { home: number; away: number } | null {
  const cleaned = String(score || "")
    .replace(/[^\d\-–: ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const m = cleaned.match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { home: a, away: b };
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
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

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

function kickoffISOFromSource(date: string, time: string) {
  const [dd, mm, yyyy] = date.split("/").map(Number);
  const [hh = 0, min = 0, sec = 0] = (time || "00:00:00").split(":").map(Number);

  const utcGuess = Date.UTC(yyyy, (mm || 1) - 1, dd || 1, hh, min, sec);
  const guessDate = new Date(utcGuess);

  const offsetMinutes = getTimeZoneOffsetMinutes(guessDate, "Australia/Sydney");
  const actualUtcMs = utcGuess - offsetMinutes * 60_000;

  return new Date(actualUtcMs).toISOString();
}

function toNum(x: string) {
  const n = Number(String(x ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function findIndex(headersLower: string[], candidates: string[]) {
  return headersLower.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));
}

export async function GET(_req: Request, ctx: { params: Promise<{ secret: string }> }) {
  // ✅ path secret auth
  const { secret } = await ctx.params;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = "https://smhockey.com.au/legends";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ ok: false, error: "failed to fetch legends" }, { status: 502 });

  const html = await res.text();
  const $ = cheerio.load(html);

  // 1) Find ladder table containing Briars (your grade)
  let ladderHeaders: string[] = [];
  let ladderRowsRaw: string[][] = [];

  $("table").each((_, table) => {
    const headers = $(table)
      .find("tr")
      .first()
      .find("th,td")
      .map((_, cell) => clean($(cell).text()))
      .get()
      .filter(Boolean);

    const headersLower = headers.map((h) => h.toLowerCase());
    const looksLikeLadder =
      headersLower.some((h) => h === "team") && headersLower.some((h) => h.includes("pts") || h.includes("point"));

    if (!looksLikeLadder) return;

    const rows: string[][] = [];
    $(table)
      .find("tr")
      .slice(1)
      .each((_, tr) => {
        const cells = $(tr)
          .find("td,th")
          .map((_, cell) => clean($(cell).text()))
          .get()
          .filter((x) => x !== "");
        if (cells.length >= 2) rows.push(cells);
      });

    const containsBriars = rows.some((r) => norm(r[0] || "").includes("briars"));
    if (!containsBriars) return;

    ladderHeaders = headers;
    ladderRowsRaw = rows;
    return false;
  });

  if (!ladderHeaders.length || !ladderRowsRaw.length) {
    return NextResponse.json({ ok: false, error: "No ladder table containing Briars found" }, { status: 500 });
  }

  const h = ladderHeaders.map((x) => String(x || "").toLowerCase());
  const idxPlayed = findIndex(h, ["games", "played", "gp"]);
  const idxWins = findIndex(h, ["wins", "win", "w"]);
  const idxDraws = findIndex(h, ["draws", "draw", "d"]);
  const idxLosses = findIndex(h, ["losses", "loss", "l"]);
  const idxGF = findIndex(h, ["gf", "goals for", "for"]);
  const idxGA = findIndex(h, ["ga", "goals against", "against"]);
  const idxGD = findIndex(h, ["gd", "diff"]);
  const idxPts = findIndex(h, ["pts", "points", "point"]);

  const ladderParsed = ladderRowsRaw.map((cells, i) => {
    const teamName = cells[0] || "";
    const played = idxPlayed >= 0 ? toNum(cells[idxPlayed]) : 0;
    const wins = idxWins >= 0 ? toNum(cells[idxWins]) : 0;
    const draws = idxDraws >= 0 ? toNum(cells[idxDraws]) : 0;
    const losses = idxLosses >= 0 ? toNum(cells[idxLosses]) : 0;
    const gf = idxGF >= 0 ? toNum(cells[idxGF]) : 0;
    const ga = idxGA >= 0 ? toNum(cells[idxGA]) : 0;
    const gd = idxGD >= 0 ? toNum(cells[idxGD]) : gf - ga;
    const points = idxPts >= 0 ? toNum(cells[idxPts]) : 0;

    return {
      teamName,
      position: i + 1,
      played,
      wins,
      draws,
      losses,
      gf,
      ga,
      gd,
      points,
    };
  });

  const gradeTeamKeys = new Set(ladderParsed.map((r) => teamKeyFromName(r.teamName)));

  // 2) Parse matches + filter to grade
  let currentRound = "";
  const matches: any[] = [];

  $("tr").each((_, tr) => {
    const rowText = clean($(tr).text());
    const roundMatch = rowText.match(/\bRound\s+\d+\b/i);
    if (roundMatch) currentRound = roundMatch[0];

    const tds = $(tr).find("td");
    if (tds.length < 6) return;

    const date = clean($(tds[0]).text());
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return;

    const homeName = clean($(tds[1]).text());
    const awayName = clean($(tds[2]).text());
    const time = clean($(tds[3]).text()) || "00:00:00";
    const venue = clean($(tds[4]).text());
    const scoreText = clean($(tds[5]).text()) || "";

    const homeKey = teamKeyFromName(homeName);
    const awayKey = teamKeyFromName(awayName);

    if (!gradeTeamKeys.has(homeKey) || !gradeTeamKeys.has(awayKey)) return;

    const kickoff_at = kickoffISOFromSource(date, time);
    const parsedScore = parseScore(scoreText);
    const source_hash = `${date}|${time}|${homeName}|${awayName}|${venue}`;

    matches.push({
      season: 2026,
      round_label: currentRound || "",
      kickoff_at,
      venue,
      home_team_key: homeKey,
      away_team_key: awayKey,
      home_score: parsedScore ? parsedScore.home : null,
      away_score: parsedScore ? parsedScore.away : null,
      source_hash,
      updated_at: new Date().toISOString(),
    });
  });

  const sb = supabaseAdmin;

  // 3) Upsert teams (from ladder)
  const teamsPayload = ladderParsed.map((r) => ({
    team_key: teamKeyFromName(r.teamName),
    name_full: r.teamName,
    short_name: r.teamName.split(/\s+/)[0] || r.teamName,
    updated_at: new Date().toISOString(),
  }));

  const { error: teamErr } = await sb.from("teams").upsert(teamsPayload, { onConflict: "team_key" });
  if (teamErr) return NextResponse.json({ ok: false, error: teamErr.message }, { status: 500 });

  // 4) Upsert matches
  const { error: matchErr } = await sb.from("matches").upsert(matches, { onConflict: "source_hash" });
  if (matchErr) return NextResponse.json({ ok: false, error: matchErr.message }, { status: 500 });

  // 5) Upsert ladder_latest (overwrite current)
  const as_of = new Date().toISOString();
  const ladderPayload = ladderParsed.map((r) => ({
    season: 2026,
    team_key: teamKeyFromName(r.teamName),
    position: r.position,
    played: r.played,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    gf: r.gf,
    ga: r.ga,
    gd: r.gd,
    points: r.points,
    as_of,
  }));

  const { error: ladderErr } = await sb.from("ladder_latest").upsert(ladderPayload, { onConflict: "season,team_key" });
  if (ladderErr) return NextResponse.json({ ok: false, error: ladderErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    ingested: { teams: teamsPayload.length, matches: matches.length, ladder_rows: ladderPayload.length },
    asOf: as_of,
  });
}
