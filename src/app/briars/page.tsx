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

type Counts = { yes: number; no: number; maybe: number };

const LS_PIN_OK = "briars_pin_ok";
const LS_PLAYER_NAME = "briars_player_name";

function formatCountdown(ms: number) {
  if (ms <= 0) return "Started";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  return `${days}d ${hours}h ${mins}m`;
}

function makeSourceKey(g: Game) {
  // Stable unique key for our DB
  return `${g.kickoffISO}|${g.home}|${g.away}`;
}

export default function BriarsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // “logged in”
  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");

  // availability summaries keyed by source_key
  const [countsByKey, setCountsByKey] = useState<Record<string, Counts>>({});

  useEffect(() => {
    const ok = localStorage.getItem(LS_PIN_OK) === "1";
    const name = localStorage.getItem(LS_PLAYER_NAME) || "";
    setPinOk(ok);
    setPlayerName(name);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function loadFixtures() {
    setLoading(true);
    const res = await fetch("/api/briars-fixtures", { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    loadFixtures();
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
    return {
      upcoming: u,
      past: p.sort(
        (a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime()
      ),
    };
  }, [data, now]);

  // Load counts for upcoming games
  useEffect(() => {
    (async () => {
      const next: Record<string, Counts> = {};
      for (const g of upcoming.slice(0, 20)) {
        const key = makeSourceKey(g);
        const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(key)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (json?.ok) next[key] = json.counts;
      }
      setCountsByKey(next);
    })();
  }, [upcoming.length]);

  function handleRememberPin() {
    // local-only “session”
    if (pinInput.trim() === "briars2026") {
      localStorage.setItem(LS_PIN_OK, "1");
      setPinOk(true);
      setPinInput("");
    } else {
      alert("Wrong PIN");
    }
  }

  function saveName() {
    const n = playerName.trim();
    if (n.length < 2) return alert("Enter your name");
    localStorage.setItem(LS_PLAYER_NAME, n);
    setPlayerName(n);
  }

  async function setStatus(g: Game, status: "yes" | "no" | "maybe") {
    if (!pinOk) return alert("Enter team PIN first");
    const n = (playerName || "").trim();
    if (n.length < 2) return alert("Enter your name");

    const source_key = makeSourceKey(g);

    const res = await fetch("/api/availability/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: "briars2026", // we only store a local flag; the server still checks the pin you send
        playerName: n,
        status,
        game: {
          source_key,
          kickoff_iso: g.kickoffISO,
          home: g.home,
          away: g.away,
          venue: g.venue,
        },
      }),
    });

    const json = await res.json();
    if (!json?.ok) {
      alert(json?.error || "Failed to save");
      return;
    }

    // refresh counts for this game
    const sum = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(source_key)}`, {
      cache: "no-store",
    }).then((r) => r.json());

    if (sum?.ok) {
      setCountsByKey((prev) => ({ ...prev, [source_key]: sum.counts }));
    }
  }

  const banner = (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {!pinOk ? (
          <>
            <strong>Team PIN</strong>
            <input
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              type="password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <button
              onClick={handleRememberPin}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 700, cursor: "pointer" }}
            >
              Remember me
            </button>
            <span style={{ opacity: 0.7 }}>One-time per device.</span>
          </>
        ) : (
          <>
            <strong>Unlocked</strong>
            <span style={{ opacity: 0.7 }}>This device is remembered.</span>
            <button
              onClick={() => {
                localStorage.removeItem(LS_PIN_OK);
                setPinOk(false);
              }}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
            >
              Log out
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>Your name</strong>
        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="e.g. Joel"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <button
          onClick={saveName}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 700, cursor: "pointer" }}
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Briars Fixtures & Results</h1>
          <p style={{ marginTop: 0, opacity: 0.7 }}>
            Last refresh: {data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "—"}
          </p>
        </div>

        <button
          onClick={loadFixtures}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", fontWeight: 700 }}
        >
          Refresh
        </button>
      </div>

      {banner}

      {loading && <p>Loading…</p>}

      {!loading && data?.ok === false && (
        <div style={{ padding: 12, border: "1px solid #f2c2c2", borderRadius: 12 }}>
          <strong>Not ready yet</strong>
          <p style={{ margin: "6px 0 0" }}>{(data as any)?.error}</p>
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
              const sourceKey = makeSourceKey(g);
              const counts = countsByKey[sourceKey] || { yes: 0, no: 0, maybe: 0 };

              return (
                <div key={idx} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>{g.home} vs {g.away}</strong>
                    <span style={{ fontWeight: 800 }}>{formatCountdown(ms)}</span>
                  </div>

                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    {g.roundLabel ? `${g.roundLabel} • ` : ""}
                    {new Date(g.kickoffISO).toLocaleString()} • {g.venue}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={() => setStatus(g, "yes")}
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 800, cursor: "pointer" }}
                    >
                      ✅ Yes
                    </button>
                    <button
                      onClick={() => setStatus(g, "maybe")}
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 800, cursor: "pointer" }}
                    >
                      ❓ Maybe
                    </button>
                    <button
                      onClick={() => setStatus(g, "no")}
                      style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 800, cursor: "pointer" }}
                    >
                      ❌ No
                    </button>

                    <span style={{ marginLeft: 6, opacity: 0.8 }}>
                      Tally: ✅ {counts.yes} &nbsp; ❓ {counts.maybe} &nbsp; ❌ {counts.no}
                    </span>
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
