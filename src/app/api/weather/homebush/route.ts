import { NextResponse } from "next/server";

const HOME_BUSH = { lat: -33.8679, lon: 151.0790 }; // Homebush NSW (approx)

function toISODateOnly(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kickoffISO = searchParams.get("kickoffISO");

  if (!kickoffISO) {
    return NextResponse.json({ ok: false, error: "Missing kickoffISO" }, { status: 400 });
  }

  const kickoff = new Date(kickoffISO);
  if (Number.isNaN(kickoff.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid kickoffISO" }, { status: 400 });
  }

  // Open-Meteo uses date range; use kickoff day ±1 buffer
  const start = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(kickoff.getTime() + 24 * 60 * 60 * 1000);

  const start_date = toISODateOnly(start);
  const end_date = toISODateOnly(end);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${HOME_BUSH.lat}&longitude=${HOME_BUSH.lon}` +
    `&hourly=temperature_2m,precipitation,wind_speed_10m,weather_code` +
    `&timezone=UTC` +
    `&timeformat=unixtime` +
    `&start_date=${start_date}&end_date=${end_date}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ ok: false, error: "Weather fetch failed" }, { status: 502 });

  const json = await res.json();
  const times: number[] = json?.hourly?.time || [];
  const temps: number[] = json?.hourly?.temperature_2m || [];
  const precip: number[] = json?.hourly?.precipitation || [];
  const wind: number[] = json?.hourly?.wind_speed_10m || [];
  const weatherCode: number[] = json?.hourly?.weather_code || [];

  if (!times.length) {
    return NextResponse.json({ ok: false, error: "No weather data" }, { status: 502 });
  }

  // Find nearest hour
  const target = Math.round(kickoff.getTime() / 1000);
  let bestIdx = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < times.length; i++) {
    const t = Number(times[i]);
    if (!Number.isFinite(t)) continue;
    const diff = Math.abs(t - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return NextResponse.json({
    ok: true,
    at: new Date(Number(times[bestIdx]) * 1000).toISOString(),
    tempC: temps[bestIdx],
    precipMM: precip[bestIdx],
    windKmh: wind[bestIdx],
    weatherCode: weatherCode[bestIdx],
    location: "Homebush NSW, Australia",
  });
}
