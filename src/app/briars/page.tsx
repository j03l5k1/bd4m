"use client";

import { useEffect, useMemo, useState } from "react";

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

type Payload = {
  ok: boolean;
  team: string;
  source: string;
  refreshedAt: string;
  games: Game[];
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "Started";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  return `${days}d ${hours}h ${mins}m`;
}

export default function BriarsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/briars-fixtures", { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const games = data?.games ?? [];
    const u: Game[] = [];
    const p: Game[] = [];

    for (const g of games) {
      const dt = new Date(g.kickoffISO);
      if (dt.getTime() >= now.getTime()) u.push(g);
      else p.push(g);
    }

    return { upcoming: u, past: p.sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime()) };
  }, [data, now]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Briars Fixtures & Results</h1>
          <p style={{ marginTop: 0, opacity: 0.7 }}>
            Auto-updates twice daily • Last refresh:{" "}
            {data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "—"}
          </p>
        </div>

        <button
          onClick={load}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Refresh view
        </button>
      </div>

      {loading && <p>Loading…</p>}

      {!loading && data?.ok === false && (
        <div style={{ padding: 12, border: "1px solid #f2c2c2", borderRadius: 12 }}>
          <strong>Not ready yet</strong>
          <p style={{ margin: "6px 0 0" }}>
            {data?.error}
          </p>
          <p style={{ margin: "10px 0 0" }}>
            Quick fix: open <code>/api/cron/refresh</code> once to populate KV.
          </p>
        </div>
      )}

      {!loading && data?.ok && (
        <>
          <section style={{ marginTop: 24 }}>
            <h2>Upcoming</h2>
            {upcoming.length === 0 && <p>No upcoming games found.</p>}
            {upcoming.map((g, idx) => {
              const dt = new Date(g.kickoffISO);
              const ms = dt.getTime() - now.getTime();

              return (
                <div key={idx} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>{g.home} vs {g.away}</strong>
                    <span style={{ fontWeight: 700 }}>{formatCountdown(ms)}</span>
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    {g.roundLabel ? `${g.roundLabel} • ` : ""}
                    {new Date(g.kickoffISO).toLocaleString()} • {g.venue} • Score: {g.score}
                  </div>
                </div>
              );
            })}
          </section>

          <section style={{ marginTop: 28 }}>
            <h2>Past Results</h2>
            {past.length === 0 && <p>No past games found.</p>}
            {past.map((g, idx) => (
              <div key={idx} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
                <strong>{g.home} vs {g.away}</strong>
                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  {g.roundLabel ? `${g.roundLabel} • ` : ""}
                  {new Date(g.kickoffISO).toLocaleString()} • {g.venue} • Final: {g.score}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
