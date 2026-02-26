import { NextResponse } from "next/server";

const HOME_BUSH = { lat: -33.8679, lon: 151.0790 }; // Homebush NSW (approx)

function toISODateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
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
    `&hourly=temperature_2m,precipitation,wind_speed_10m` +
    `&timezone=Australia%2FSydney` +
    `&start_date=${start_date}&end_date=${end_date}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ ok: false, error: "Weather fetch failed" }, { status: 502 });

  const json = await res.json();
  const times: string[] = json?.hourly?.time || [];
  const temps: number[] = json?.hourly?.temperature_2m || [];
  const precip: number[] = json?.hourly?.precipitation || [];
  const wind: number[] = json?.hourly?.wind_speed_10m || [];

  if (!times.length) {
    return NextResponse.json({ ok: false, error: "No weather data" }, { status: 502 });
  }

  // Find nearest hour
  const target = kickoff.getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    const diff = Math.abs(t - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return NextResponse.json({
    ok: true,
    at: times[bestIdx],
    tempC: temps[bestIdx],
    precipMM: precip[bestIdx],
    windKmh: wind[bestIdx],
    location: "Homebush NSW",
  });
}
