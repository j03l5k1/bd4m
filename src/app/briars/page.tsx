"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Users, ShieldCheck, Trophy, ChevronDown } from "lucide-react";

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
const LS_TEAM_PIN = "briars_team_pin";

// Logos from SMHA club images (stable URLs)
const CLUB_LOGOS: Record<string, string> = {
  briars: "https://smhockey.com.au/wireframe/assets/images/briars_logo.jpg",
  macarthur: "https://smhockey.com.au/wireframe/assets/images/mac_logo.png",
  macquarie: "https://smhockey.com.au/wireframe/assets/images/mac_uni.png",
  manly: "https://smhockey.com.au/wireframe/assets/images/manly_logo.jpg",
  penrith: "https://smhockey.com.au/wireframe/assets/images/penrith_logo.jpg",
  ryde: "https://smhockey.com.au/wireframe/assets/images/ryde_logo.png",
};

function clubKey(teamName: string) {
  const s = teamName.toLowerCase();
  if (s.includes("briars")) return "briars";
  if (s.includes("macarthur")) return "macarthur";
  if (s.includes("macquarie")) return "macquarie";
  if (s.includes("manly") || s.includes("gns")) return "manly";
  if (s.includes("penrith")) return "penrith";
  if (s.includes("ryde")) return "ryde";
  return "";
}

function makeSourceKey(g: Game) {
  return `${g.kickoffISO}|${g.home}|${g.away}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Started";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  return `${days}d ${hours}h ${mins}m`;
}

function badgeStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    border: "1px solid var(--stroke)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    color: "var(--muted)",
    fontSize: 13,
    fontWeight: 700 as const,
  };
}

function cardStyle() {
  return {
    border: "1px solid var(--stroke)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow)",
  };
}

function Logo({ url }: { url?: string }) {
  return (
    <div
      style={{
        width: 54,
        height: 54,
        borderRadius: 14,
        border: "1px solid var(--stroke)",
        background: "rgba(255,255,255,0.06)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
      ) : (
        <span style={{ color: "var(--muted2)", fontWeight: 900 }}>—</span>
      )}
    </div>
  );
}

export default function BriarsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [countsByKey, setCountsByKey] = useState<Record<string, Counts>>({});

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
    setPlayerName(localStorage.getItem(LS_PLAYER_NAME) || "");
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

  const { upcoming, past, nextGame } = useMemo(() => {
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
      past: p.sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime()),
      nextGame: u.length ? u[0] : null,
    };
  }, [data, now]);

  useEffect(() => {
    (async () => {
      const next: Record<string, Counts> = {};
      for (const g of upcoming.slice(0, 25)) {
        const key = makeSourceKey(g);
        const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(key)}`, { cache: "no-store" });
        const json = await res.json();
        if (json?.ok) next[key] = json.counts;
      }
      setCountsByKey(next);
    })();
  }, [upcoming.length]);

  function rememberPin() {
    if (pinInput.trim() !== "briars2026") return alert("Wrong PIN");
    localStorage.setItem(LS_PIN_OK, "1");
    localStorage.setItem(LS_TEAM_PIN, "briars2026");
    setPinOk(true);
    setPinInput("");
  }

  function saveName() {
    const n = playerName.trim();
    if (n.length < 2) return alert("Enter your name");
    localStorage.setItem(LS_PLAYER_NAME, n);
    setPlayerName(n);
  }

  async function setStatus(g: Game, status: "yes" | "no" | "maybe") {
    if (!pinOk) return alert("Enter team PIN first");
    const n = playerName.trim();
    if (n.length < 2) return alert("Enter your name");

    const source_key = makeSourceKey(g);

    const res = await fetch("/api/availability/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: localStorage.getItem(LS_TEAM_PIN) || "",
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
    if (!json?.ok) return alert(json?.error || "Failed to save");

    const sum = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(source_key)}`, { cache: "no-store" }).then((r) => r.json());
    if (sum?.ok) setCountsByKey((prev) => ({ ...prev, [source_key]: sum.counts }));
  }

  const shell = { maxWidth: 1100, margin: "0 auto", padding: 18 };

  return (
    <main>
      {/* Header */}
      <div style={{ ...shell, paddingTop: 22, paddingBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>
              Briars Legends
            </div>
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14 }}>
              Last refresh{" "}
              <span style={{ color: "var(--text)", fontWeight: 900 }}>
                {data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>

          <button
            onClick={loadFixtures}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--stroke)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--text)",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <div style={{ ...shell, color: "var(--muted)" }}>Loading…</div>}

      {!loading && (
        <>
          {/* PIN + Name */}
          <div style={shell}>
            <div style={{ ...cardStyle(), padding: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {!pinOk ? (
                  <>
                    <span style={badgeStyle()}><ShieldCheck size={16} /> Team PIN</span>
                    <input
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="Enter PIN"
                      type="password"
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid var(--stroke)",
                        background: "rgba(0,0,0,0.20)",
                        color: "var(--text)",
                        outline: "none",
                        minWidth: 180,
                      }}
                    />
                    <button
                      onClick={rememberPin}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid var(--stroke)",
                        background: "rgba(255,255,255,0.10)",
                        color: "var(--text)",
                        fontWeight: 950,
                        cursor: "pointer",
                      }}
                    >
                      Remember me
                    </button>
                  </>
                ) : (
                  <>
                    <span style={badgeStyle()}><ShieldCheck size={16} /> Unlocked</span>
                    <button
                      onClick={() => {
                        localStorage.removeItem(LS_PIN_OK);
                        localStorage.removeItem(LS_TEAM_PIN);
                        setPinOk(false);
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid var(--stroke)",
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--text)",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Log out
                    </button>
                  </>
                )}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={badgeStyle()}><Users size={16} /> Your name</span>
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g. Joel"
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--stroke)",
                    background: "rgba(0,0,0,0.20)",
                    color: "var(--text)",
                    outline: "none",
                    minWidth: 220,
                  }}
                />
                <button
                  onClick={saveName}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--stroke)",
                    background: "rgba(255,255,255,0.10)",
                    color: "var(--text)",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* NEXT GAME banner */}
          {nextGame && (() => {
            const dt = new Date(nextGame.kickoffISO);
            const ms = dt.getTime() - now.getTime();
            const key = makeSourceKey(nextGame);
            const counts = countsByKey[key] || { yes: 0, no: 0, maybe: 0 };

            const homeLogo = CLUB_LOGOS[clubKey(nextGame.home)];
            const awayLogo = CLUB_LOGOS[clubKey(nextGame.away)];

            return (
              <div style={shell}>
                <div style={{ ...cardStyle(), padding: 18, position: "relative", overflow: "hidden" }}>
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "radial-gradient(900px 420px at 20% 10%, rgba(255,255,255,0.10), transparent 55%)," +
                        "radial-gradient(700px 340px at 90% 20%, rgba(255,255,255,0.08), transparent 55%)," +
                        "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.0))",
                      transform: "scale(1.05)",
                    }}
                  />

                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ ...badgeStyle(), color: "rgba(255,255,255,0.85)" }}>
                        <Trophy size={16} /> NEXT GAME
                      </span>
                      <div style={{ color: "var(--muted)", fontSize: 14 }}>
                        Starts in <span style={{ color: "var(--text)", fontWeight: 950 }}>{formatCountdown(ms)}</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center", marginTop: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Logo url={homeLogo} />
                        <div>
                          <div style={{ fontWeight: 950, fontSize: 18 }}>{nextGame.home}</div>
                          <div style={{ color: "var(--muted2)", fontSize: 13 }}>Home</div>
                        </div>
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 700, letterSpacing: -0.6 }}>vs</div>
                        <div style={{ color: "var(--muted2)", fontSize: 12 }}>{nextGame.roundLabel || "Fixture"}</div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 950, fontSize: 18 }}>{nextGame.away}</div>
                          <div style={{ color: "var(--muted2)", fontSize: 13 }}>Away</div>
                        </div>
                        <Logo url={awayLogo} />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                      <span style={badgeStyle()}><CalendarDays size={16} /> {dt.toLocaleDateString()}</span>
                      <span style={badgeStyle()}><Clock3 size={16} /> {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span style={badgeStyle()}><MapPin size={16} /> {nextGame.venue || "—"}</span>
                      <span style={badgeStyle()}><Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}</span>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <details style={{ border: "1px solid var(--stroke)", background: "rgba(0,0,0,0.20)", borderRadius: 14, padding: 12 }}>
                        <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontWeight: 950 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Users size={18} /> Mark availability
                          </span>
                          <span style={{ color: "var(--muted)" }}>
                            Expand <ChevronDown size={16} style={{ verticalAlign: "-3px" }} />
                          </span>
                        </summary>

                        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button onClick={() => setStatus(nextGame, "yes")} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--stroke)", background: "rgba(255,255,255,0.10)", color: "var(--text)", fontWeight: 950, cursor: "pointer" }}>
                            ✅ Yes
                          </button>
                          <button onClick={() => setStatus(nextGame, "maybe")} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--stroke)", background: "rgba(255,255,255,0.10)", color: "var(--text)", fontWeight: 950, cursor: "pointer" }}>
                            ❓ Maybe
                          </button>
                          <button onClick={() => setStatus(nextGame, "no")} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--stroke)", background: "rgba(255,255,255,0.10)", color: "var(--text)", fontWeight: 950, cursor: "pointer" }}>
                            ❌ No
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Upcoming table */}
          <div style={{ ...shell, marginTop: 16 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700 }}>Upcoming fixtures</div>

            <div style={{ ...cardStyle(), marginTop: 10, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                      {["Match", "When", "Where", "Countdown", "Availability"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "14px 14px",
                            fontSize: 12,
                            letterSpacing: 0.6,
                            color: "var(--muted)",
                            borderBottom: "1px solid var(--stroke)",
                            textTransform: "uppercase",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.slice(0, 20).map((g, idx) => {
                      const dt = new Date(g.kickoffISO);
                      const ms = dt.getTime() - now.getTime();
                      const key = makeSourceKey(g);
                      const counts = countsByKey[key] || { yes: 0, no: 0, maybe: 0 };

                      const homeLogo = CLUB_LOGOS[clubKey(g.home)];
                      const awayLogo = CLUB_LOGOS[clubKey(g.away)];

                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--stroke)" }}>
                          <td style={{ padding: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Logo url={homeLogo} />
                              <div style={{ opacity: 0.9, fontWeight: 900 }}>vs</div>
                              <Logo url={awayLogo} />
                              <div style={{ marginLeft: 6 }}>
                                <div style={{ fontWeight: 950 }}>{g.home} vs {g.away}</div>
                                <div style={{ color: "var(--muted2)", fontSize: 13 }}>{g.roundLabel || "—"}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: 14, color: "var(--muted)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Clock3 size={16} />
                              <div>
                                <div style={{ color: "var(--text)", fontWeight: 900 }}>
                                  {dt.toLocaleDateString()} • {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </div>
                                <div style={{ color: "var(--muted2)", fontSize: 13 }}>{g.score && g.score !== "-" ? `Last/Final: ${g.score}` : "—"}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: 14, color: "var(--muted)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <MapPin size={16} />
                              <div>
                                <div style={{ color: "var(--text)", fontWeight: 900 }}>{g.venue || "—"}</div>
                                <div style={{ color: "var(--muted2)", fontSize: 13 }}>SMHA Legends</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: 14 }}>
                            <span style={{ ...badgeStyle(), color: "rgba(255,255,255,0.90)" }}>{formatCountdown(ms)}</span>
                          </td>

                          <td style={{ padding: 14 }}>
                            <details style={{ border: "1px solid var(--stroke)", background: "rgba(0,0,0,0.20)", borderRadius: 14, padding: 10, maxWidth: 360 }}>
                              <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontWeight: 950 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}
                                </span>
                                <ChevronDown size={16} style={{ color: "var(--muted)" }} />
                              </summary>

                              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button onClick={() => setStatus(g, "yes")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--stroke)", background: "rgba(255,255,255,0.10)", color: "var(--text)", fontWeight: 950, cursor: "pointer" }}>
                                  ✅ Yes
                                </button>
                                <button onClick={() => setStatus(g, "maybe")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--stroke)", background: "rgba(255,255,255,0.10)", color: "var(--text)", fontWeight: 950, cursor: "pointer" }}>
                                  ❓ Maybe
                                </button>
                                <button onClick={() => setStatus(g, "no")} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--stroke)", background: "rgba(255,255,255,0.10)", color: "var(--text)", fontWeight: 950, cursor: "pointer" }}>
                                  ❌ No
                                </button>
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    })}

                    {upcoming.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 16, color: "var(--muted)" }}>
                          No upcoming games found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Past results */}
          <div style={{ ...shell, marginTop: 18, paddingBottom: 38 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 700 }}>Past results</div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {past.slice(0, 12).map((g, idx) => {
                const dt = new Date(g.kickoffISO);
                const homeLogo = CLUB_LOGOS[clubKey(g.home)];
                const awayLogo = CLUB_LOGOS[clubKey(g.away)];

                return (
                  <div key={idx} style={{ ...cardStyle(), padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Logo url={homeLogo} />
                        <div style={{ opacity: 0.9, fontWeight: 900 }}>vs</div>
                        <Logo url={awayLogo} />
                        <div style={{ marginLeft: 6 }}>
                          <div style={{ fontWeight: 950 }}>{g.home} vs {g.away}</div>
                          <div style={{ color: "var(--muted2)", fontSize: 13 }}>
                            {g.roundLabel ? `${g.roundLabel} • ` : ""}{dt.toLocaleString()} • {g.venue}
                          </div>
                        </div>
                      </div>

                      <span style={badgeStyle()}>
                        <Trophy size={16} /> Final: <span style={{ color: "var(--text)" }}>{g.score}</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {past.length === 0 && (
                <div style={{ ...cardStyle(), padding: 14, color: "var(--muted)" }}>
                  No past games found.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
