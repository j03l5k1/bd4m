"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  ShieldCheck,
  Trophy,
  ChevronDown,
  Download,
} from "lucide-react";

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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--stroke)",
        background: "rgba(255,255,255,0.86)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        border: "1px solid var(--stroke)",
        background: "rgba(17,24,39,0.03)",
        borderRadius: 999,
        color: "var(--muted)",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function Btn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--stroke2)",
        background: "white",
        color: "var(--text)",
        cursor: "pointer",
        fontWeight: 800,
        boxShadow: "var(--shadow2)",
      }}
    >
      {children}
    </button>
  );
}

function SoftBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--stroke)",
        background: "rgba(17,24,39,0.03)",
        color: "var(--text)",
        cursor: "pointer",
        fontWeight: 850,
      }}
    >
      {children}
    </button>
  );
}

function Logo({ url }: { url?: string }) {
  return (
    <div
      style={{
        width: 54,
        height: 54,
        borderRadius: 14,
        border: "1px solid var(--stroke)",
        background: "white",
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

  function persistName(next: string) {
    const n = next.trim();
    setPlayerName(next);
    if (n.length >= 2) localStorage.setItem(LS_PLAYER_NAME, n);
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
      <div style={{ ...shell, paddingTop: 22, paddingBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.4 }}>Briars Legends</div>
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14 }}>
              Last refresh{" "}
              <span style={{ color: "var(--text)", fontWeight: 850 }}>
                {data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={() => (window.location.href = "/api/calendar/all")}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Download size={18} /> Add all games to calendar
              </span>
            </Btn>
            <SoftBtn onClick={loadFixtures}>Refresh</SoftBtn>
          </div>
        </div>
      </div>

      {loading && <div style={{ ...shell, color: "var(--muted)" }}>Loading…</div>}

      {!loading && (
        <>
          {/* NEXT GAME dominant ATF */}
          {nextGame && (() => {
            const dt = new Date(nextGame.kickoffISO);
            const ms = dt.getTime() - now.getTime();
            const key = makeSourceKey(nextGame);
            const counts = countsByKey[key] || { yes: 0, no: 0, maybe: 0 };

            const homeLogo = CLUB_LOGOS[clubKey(nextGame.home)];
            const awayLogo = CLUB_LOGOS[clubKey(nextGame.away)];

            return (
              <div style={shell}>
                <Card>
                  <div style={{ padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill><Trophy size={16} /> NEXT GAME</Pill>
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

                      <div style={{ textAlign: "center", color: "var(--muted)", fontWeight: 900 }}>
                        VS
                        <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 4 }}>{nextGame.roundLabel || "Fixture"}</div>
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
                      <Pill><CalendarDays size={16} /> {dt.toLocaleDateString()}</Pill>
                      <Pill><Clock3 size={16} /> {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Pill>
                      <Pill><MapPin size={16} /> {nextGame.venue || "—"}</Pill>
                      <Pill><Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}</Pill>
                    </div>

                    <div style={{ marginTop: 14, borderTop: "1px solid var(--stroke)", paddingTop: 14 }}>
                      <details style={{ border: "1px solid var(--stroke)", background: "rgba(17,24,39,0.02)", borderRadius: 14, padding: 12 }}>
                        <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontWeight: 950 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Users size={18} /> Mark availability
                          </span>
                          <span style={{ color: "var(--muted)" }}>
                            Expand <ChevronDown size={16} style={{ verticalAlign: "-3px" }} />
                          </span>
                        </summary>

                        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <Btn onClick={() => setStatus(nextGame, "yes")}>✅ Yes</Btn>
                          <Btn onClick={() => setStatus(nextGame, "maybe")}>❓ Maybe</Btn>
                          <Btn onClick={() => setStatus(nextGame, "no")}>❌ No</Btn>
                        </div>
                      </details>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })()}

          {/* Auth BELOW next game, name above pin, no save button */}
          <div style={shell}>
            <Card>
              <div style={{ padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8, color: "var(--muted)" }}>
                      Your name
                    </div>
                    <input
                      value={playerName}
                      onChange={(e) => persistName(e.target.value)}
                      onBlur={(e) => persistName(e.target.value)}
                      placeholder="e.g. Joel"
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid var(--stroke2)",
                        background: "white",
                        color: "var(--text)",
                        outline: "none",
                        boxShadow: "var(--shadow2)",
                      }}
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted2)" }}>
                      Saved automatically on this device.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8, color: "var(--muted)" }}>
                      Team PIN
                    </div>
                    {!pinOk ? (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <input
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          placeholder="Enter PIN"
                          type="password"
                          style={{
                            flex: "1 1 180px",
                            padding: 12,
                            borderRadius: 12,
                            border: "1px solid var(--stroke2)",
                            background: "white",
                            color: "var(--text)",
                            outline: "none",
                            boxShadow: "var(--shadow2)",
                          }}
                        />
                        <Btn onClick={rememberPin}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <ShieldCheck size={18} /> Remember me
                          </span>
                        </Btn>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <Pill><ShieldCheck size={16} /> Unlocked on this device</Pill>
                        <SoftBtn
                          onClick={() => {
                            localStorage.removeItem(LS_PIN_OK);
                            localStorage.removeItem(LS_TEAM_PIN);
                            setPinOk(false);
                          }}
                        >
                          Log out
                        </SoftBtn>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Upcoming fixtures collapsible */}
          <div style={{ ...shell, marginTop: 8 }}>
            <details open={false}>
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  fontWeight: 950,
                  fontSize: 18,
                  padding: "10px 0",
                }}
              >
                <span>Upcoming fixtures</span>
                <span style={{ color: "var(--muted)", fontSize: 14 }}>
                  Expand <ChevronDown size={16} style={{ verticalAlign: "-3px" }} />
                </span>
              </summary>

              <Card>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                    <thead>
                      <tr style={{ background: "rgba(17,24,39,0.02)" }}>
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
                                <div style={{ opacity: 0.7, fontWeight: 950 }}>vs</div>
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
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: 14, color: "var(--muted)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <MapPin size={16} />
                                <div style={{ color: "var(--text)", fontWeight: 850 }}>{g.venue || "—"}</div>
                              </div>
                            </td>

                            <td style={{ padding: 14 }}>
                              <Pill>{formatCountdown(ms)}</Pill>
                            </td>

                            <td style={{ padding: 14 }}>
                              <details style={{ border: "1px solid var(--stroke)", background: "rgba(17,24,39,0.02)", borderRadius: 14, padding: 10, maxWidth: 380 }}>
                                <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontWeight: 950 }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}
                                  </span>
                                  <ChevronDown size={16} style={{ color: "var(--muted)" }} />
                                </summary>

                                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <Btn onClick={() => setStatus(g, "yes")}>✅ Yes</Btn>
                                  <Btn onClick={() => setStatus(g, "maybe")}>❓ Maybe</Btn>
                                  <Btn onClick={() => setStatus(g, "no")}>❌ No</Btn>
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
              </Card>
            </details>
          </div>

          {/* Past results minimal */}
          <div style={{ ...shell, marginTop: 10, paddingBottom: 38 }}>
            <div style={{ fontSize: 18, fontWeight: 950, padding: "10px 0" }}>Past results</div>

            <div style={{ display: "grid", gap: 10 }}>
              {past.slice(0, 12).map((g, idx) => {
                const dt = new Date(g.kickoffISO);
                return (
                  <Card key={idx}>
                    <div style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 950 }}>{g.home} vs {g.away}</div>
                        <div style={{ color: "var(--muted2)", fontSize: 13 }}>
                          {g.roundLabel ? `${g.roundLabel} • ` : ""}{dt.toLocaleString()} • {g.venue}
                        </div>
                      </div>
                      <Pill><Trophy size={16} /> Final: <span style={{ color: "var(--text)" }}>{g.score}</span></Pill>
                    </div>
                  </Card>
                );
              })}

              {past.length === 0 && (
                <Card>
                  <div style={{ padding: 14, color: "var(--muted)" }}>No past games found.</div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
