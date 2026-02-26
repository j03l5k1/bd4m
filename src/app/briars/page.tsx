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
  ChevronUp,
  LogOut,
  CloudSun,
  Droplets,
  Wind,
} from "lucide-react";
import { SiGooglecalendar } from "react-icons/si";
import styles from "./briars.module.css";

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

type LadderPayload = {
  headers: string[];
  rows: { team: string; cols: string[] }[];
};

type Payload = {
  ok: boolean;
  team: string;
  source: string;
  refreshedAt: string;
  games: Game[];
  ladder?: LadderPayload;
};

type Counts = { yes: number; no: number; maybe: number };

type Weather = {
  ok: boolean;
  at?: string;
  tempC?: number;
  precipMM?: number;
  windKmh?: number;
  location?: string;
};

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

function num(x: string | undefined) {
  if (!x) return 0;
  const n = Number(String(x).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function Pill({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return <span className={`${styles.pill} ${subtle ? styles.pillSubtle : ""}`}>{children}</span>;
}

function Button({
  children,
  onClick,
  kind = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "soft";
}) {
  return (
    <button
      className={`${styles.btn} ${kind === "primary" ? styles.btnPrimary : styles.btnSoft}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Logo({ url }: { url?: string }) {
  return (
    <div className={styles.logo}>
      {url ? <img className={styles.logoImg} src={url} alt="" /> : <span className={styles.logoFallback}>—</span>}
    </div>
  );
}

export default function BriarsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [countsByKey, setCountsByKey] = useState<Record<string, Counts>>({});
  const [weather, setWeather] = useState<Weather | null>(null);

  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const [ladderSortKey, setLadderSortKey] = useState<string>("PTS");
  const [ladderSortDir, setLadderSortDir] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
    setPlayerName(localStorage.getItem(LS_PLAYER_NAME) || "");
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
    u.sort((a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());
    p.sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime());
    return { upcoming: u, past: p, nextGame: u[0] || null };
  }, [data, now]);

  useEffect(() => {
    (async () => {
      const next: Record<string, Counts> = {};
      for (const g of upcoming.slice(0, 30)) {
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

  useEffect(() => {
    (async () => {
      if (!nextGame) return setWeather(null);
      const res = await fetch(`/api/weather/homebush?kickoffISO=${encodeURIComponent(nextGame.kickoffISO)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      setWeather(json);
    })();
  }, [nextGame?.kickoffISO]);

  const loginComplete = useMemo(() => {
    const nOk = (playerName || "").trim().length >= 2;
    return pinOk && nOk;
  }, [pinOk, playerName]);

  function persistName(next: string) {
    setPlayerName(next);
    const n = next.trim();
    if (n.length >= 2) localStorage.setItem(LS_PLAYER_NAME, n);
  }

  function rememberPin() {
    if (pinInput.trim() !== "briars2026") return alert("Wrong PIN");
    localStorage.setItem(LS_PIN_OK, "1");
    localStorage.setItem(LS_TEAM_PIN, "briars2026");
    setPinOk(true);
    setPinInput("");
  }

  function logout() {
    localStorage.removeItem(LS_PIN_OK);
    localStorage.removeItem(LS_TEAM_PIN);
    setPinOk(false);
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

    const sum = await fetch(
      `/api/availability/summary?source_key=${encodeURIComponent(source_key)}`,
      { cache: "no-store" }
    ).then((r) => r.json());

    if (sum?.ok) setCountsByKey((prev) => ({ ...prev, [source_key]: sum.counts }));
  }

  // Ladder sort
  const ladder = data?.ladder;
  const ladderHeaders = ladder?.headers || [];
  const ladderRows = ladder?.rows || [];

  const headerIndex = useMemo(() => {
    const map: Record<string, number> = {};
    ladderHeaders.forEach((h, i) => (map[h.trim().toLowerCase()] = i));
    return map;
  }, [ladderHeaders.join("|")]);

  function findIndexByNames(names: string[]) {
    for (const n of names) {
      const idx = headerIndex[n.toLowerCase()];
      if (typeof idx === "number") return idx;
    }
    return -1;
  }

  const idxTeam = 0;
  const idxPts = findIndexByNames(["pts", "points"]);
  const idxGD = findIndexByNames(["gd", "goal difference", "+/-"]);
  const idxGF = findIndexByNames(["gf", "for"]);

  const sortedLadderRows = useMemo(() => {
    const rows = [...ladderRows];

    // Default tie-break: Pts desc, then GD desc, then GF desc
    rows.sort((a, b) => {
      const aPts = idxPts >= 0 ? num(a.cols[idxPts]) : 0;
      const bPts = idxPts >= 0 ? num(b.cols[idxPts]) : 0;
      if (bPts !== aPts) return bPts - aPts;

      const aGD = idxGD >= 0 ? num(a.cols[idxGD]) : 0;
      const bGD = idxGD >= 0 ? num(b.cols[idxGD]) : 0;
      if (bGD !== aGD) return bGD - aGD;

      const aGFv = idxGF >= 0 ? num(a.cols[idxGF]) : 0;
      const bGFv = idxGF >= 0 ? num(b.cols[idxGF]) : 0;
      if (bGFv !== aGFv) return bGFv - aGFv;

      return String(a.cols[idxTeam]).localeCompare(String(b.cols[idxTeam]));
    });

    // User sort overrides (still stable with tie-break fallback)
    if (ladderSortKey && ladderHeaders.length) {
      const keyLower = ladderSortKey.toLowerCase();
      const idx = headerIndex[keyLower];
      if (typeof idx === "number") {
        rows.sort((a, b) => {
          const av = num(a.cols[idx]);
          const bv = num(b.cols[idx]);
          if (av === bv) {
            const aPts = idxPts >= 0 ? num(a.cols[idxPts]) : 0;
            const bPts = idxPts >= 0 ? num(b.cols[idxPts]) : 0;
            if (bPts !== aPts) return bPts - aPts;

            const aGD = idxGD >= 0 ? num(a.cols[idxGD]) : 0;
            const bGD = idxGD >= 0 ? num(b.cols[idxGD]) : 0;
            if (bGD !== aGD) return bGD - aGD;

            return String(a.cols[idxTeam]).localeCompare(String(b.cols[idxTeam]));
          }
          return ladderSortDir === "desc" ? bv - av : av - bv;
        });
      }
    }

    return rows;
  }, [ladderRows, ladderHeaders.join("|"), ladderSortKey, ladderSortDir, headerIndex, idxPts, idxGD, idxGF]);

  function onLadderHeaderClick(h: string) {
    const upper = h.toUpperCase();
    if (ladderSortKey === upper) {
      setLadderSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setLadderSortKey(upper);
      setLadderSortDir("desc");
    }
  }

  // UI helpers
  const showLogin = !loginComplete;

  const upcomingPreview = upcoming.slice(0, 5);
  const upcomingAll = upcoming;

  function GameCard({ g }: { g: Game }) {
    const dt = new Date(g.kickoffISO);
    const ms = dt.getTime() - now.getTime();
    const counts = countsByKey[makeSourceKey(g)] || { yes: 0, no: 0, maybe: 0 };
    const homeLogo = CLUB_LOGOS[clubKey(g.home)];
    const awayLogo = CLUB_LOGOS[clubKey(g.away)];

    return (
      <div className={styles.gcard}>
        <div className={styles.gTop}>
          <div className={styles.gMatch}>
            <Logo url={homeLogo} />
            <span className={styles.gVs}>vs</span>
            <Logo url={awayLogo} />
            <div className={styles.gNames}>
              <div className={styles.gTitle}>{g.home} vs {g.away}</div>
              <div className={styles.gSub}>{g.roundLabel || "Fixture"}</div>
            </div>
          </div>
          <Pill subtle>{formatCountdown(ms)}</Pill>
        </div>

        <div className={styles.gMeta}>
          <span className={styles.gMetaItem}>
            <Clock3 size={16} /> {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className={styles.gMetaItem}>
            <MapPin size={16} /> {g.venue || "—"}
          </span>
        </div>

        <details className={styles.details}>
          <summary className={styles.summary}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}
            </span>
            <ChevronDown size={16} />
          </summary>
          <div className={styles.btnRow}>
            <Button onClick={() => setStatus(g, "yes")}>✅ Yes</Button>
            <Button onClick={() => setStatus(g, "maybe")}>❓ Maybe</Button>
            <Button onClick={() => setStatus(g, "no")}>❌ No</Button>
          </div>
        </details>
      </div>
    );
  }

  return (
    <main>
      <div className={styles.shell}>
        <div className={styles.header}>
          <div>
            <div className={styles.h1}>Briars Legends</div>
            <div className={styles.sub}>
              Last refresh{" "}
              <span className={styles.strong}>
                {data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <Button onClick={() => (window.location.href = "/api/calendar/all")}>
              <SiGooglecalendar size={18} />
              Add to calendar
            </Button>

            {!showLogin && (
              <Pill>
                <Users size={16} />
                {(playerName || "").trim() || "Player"}
                <button
                  onClick={logout}
                  style={{
                    marginLeft: 6,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 950,
                    color: "rgba(17,24,39,0.70)",
                  }}
                  title="Log out PIN on this device"
                >
                  <LogOut size={16} />
                </button>
              </Pill>
            )}

            <Button kind="soft" onClick={loadFixtures}>Refresh</Button>
          </div>
        </div>

        {loading && <div className={styles.sub}>Loading…</div>}

        {!loading && (
          <>
            {showLogin && (
              <div className={`${styles.card} ${styles.cardPad}`}>
                <div className={styles.loginGrid}>
                  <div>
                    <div className={styles.label}>Your name</div>
                    <input
                      value={playerName}
                      onChange={(e) => persistName(e.target.value)}
                      onBlur={(e) => persistName(e.target.value)}
                      placeholder="e.g. Joel"
                      className={styles.input}
                    />
                    <div className={styles.hint}>Saved automatically on this device.</div>
                  </div>

                  <div>
                    <div className={styles.label}>Team PIN</div>
                    {!pinOk ? (
                      <div className={styles.pinRow}>
                        <input
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          placeholder="Enter PIN"
                          type="password"
                          className={styles.input}
                        />
                        <Button onClick={rememberPin}>
                          <ShieldCheck size={18} />
                          Remember
                        </Button>
                      </div>
                    ) : (
                      <div className={styles.pinRow}>
                        <Pill><ShieldCheck size={16} /> Unlocked on this device</Pill>
                        <Button kind="soft" onClick={logout}>Log out</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Next game */}
            {(() => {
              if (!nextGame) return null;

              const dt = new Date(nextGame.kickoffISO);
              const ms = dt.getTime() - now.getTime();
              const counts = countsByKey[makeSourceKey(nextGame)] || { yes: 0, no: 0, maybe: 0 };
              const homeLogo = CLUB_LOGOS[clubKey(nextGame.home)];
              const awayLogo = CLUB_LOGOS[clubKey(nextGame.away)];

              return (
                <div style={{ marginTop: showLogin ? 14 : 0 }}>
                  <div className={styles.card}>
                    <div className={styles.cardPad}>
                      <div className={styles.rowTop}>
                        <Pill><Trophy size={16} /> Next game</Pill>
                        <Pill subtle>
                          Starts in <b style={{ color: "var(--text)" }}>{formatCountdown(ms)}</b>
                        </Pill>
                      </div>

                      <div className={styles.vsGrid}>
                        <div className={styles.team}>
                          <Logo url={homeLogo} />
                          <div>
                            <div className={styles.teamName}>{nextGame.home}</div>
                            <div className={styles.subMini}>Home</div>
                          </div>
                        </div>

                        <div className={styles.mid}>
                          <div className={styles.vs}>VS</div>
                          <div className={styles.subMini}>{nextGame.roundLabel || "Fixture"}</div>
                        </div>

                        <div className={`${styles.team} ${styles.teamRight}`}>
                          <div>
                            <div className={styles.teamName}>{nextGame.away}</div>
                            <div className={styles.subMini}>Away</div>
                          </div>
                          <Logo url={awayLogo} />
                        </div>
                      </div>

                      <div className={styles.chips}>
                        <Pill><CalendarDays size={16} /> {dt.toLocaleDateString()}</Pill>
                        <Pill><Clock3 size={16} /> {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Pill>
                        <Pill><MapPin size={16} /> {nextGame.venue || "—"}</Pill>
                        <Pill><Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}</Pill>

                        {weather?.ok && (
                          <Pill>
                            <CloudSun size={16} />
                            {weather.tempC?.toFixed?.(0)}°C
                            <span style={{ opacity: 0.65 }}>·</span>
                            <Droplets size={16} />
                            {weather.precipMM?.toFixed?.(0)}mm
                            <span style={{ opacity: 0.65 }}>·</span>
                            <Wind size={16} />
                            {weather.windKmh?.toFixed?.(0)}km/h
                          </Pill>
                        )}
                      </div>

                      <div className={styles.divider} />

                      <details className={styles.details}>
                        <summary className={styles.summary}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                            <Users size={18} /> Mark availability
                          </span>
                          <span className={styles.summaryRight}>
                            Expand <ChevronDown size={16} />
                          </span>
                        </summary>

                        <div className={styles.btnRow}>
                          <Button onClick={() => setStatus(nextGame, "yes")}>✅ Yes</Button>
                          <Button onClick={() => setStatus(nextGame, "maybe")}>❓ Maybe</Button>
                          <Button onClick={() => setStatus(nextGame, "no")}>❌ No</Button>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Upcoming fixtures */}
            <div style={{ marginTop: 18 }}>
              <div className={styles.sectionTop}>
                <div className={styles.sectionTitle}>Upcoming fixtures</div>
                <button className={styles.pillBtn} onClick={() => setShowAllUpcoming((v) => !v)}>
                  {showAllUpcoming ? (
                    <>
                      <ChevronUp size={16} /> Hide full list
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} /> Show all ({upcomingAll.length})
                    </>
                  )}
                </button>
              </div>

              <div className={styles.grid}>
                {(showAllUpcoming ? upcomingAll : upcomingPreview).map((g, i) => (
                  <GameCard key={`${g.kickoffISO}-${i}`} g={g} />
                ))}
              </div>

              {upcomingAll.length === 0 && (
                <div className={`${styles.card} ${styles.cardPad}`}>
                  <div className={styles.sub}>No upcoming games found.</div>
                </div>
              )}
            </div>

            {/* Ladder */}
            <div style={{ marginTop: 18 }}>
              <div className={styles.sectionTop}>
                <div className={styles.sectionTitle}>Snr Masters Ladder</div>
                <Pill subtle>Default: Pts ↓ then GD ↓</Pill>
              </div>

              <div className={styles.card}>
                <div className={styles.ladderWrap}>
                  <table className={styles.ladder}>
                    <thead>
                      <tr>
                        {ladderHeaders.map((h) => {
                          const upper = h.toUpperCase();
                          const isActive = ladderSortKey === upper;
                          return (
                            <th
                              key={h}
                              className={`${styles.ladderTh} ${isActive ? styles.ladderThActive : ""}`}
                              onClick={() => {
                                if (ladderSortKey === upper) {
                                  setLadderSortDir((d) => (d === "desc" ? "asc" : "desc"));
                                } else {
                                  setLadderSortKey(upper);
                                  setLadderSortDir("desc");
                                }
                              }}
                              title="Click to sort"
                            >
                              {h}
                              {isActive ? (ladderSortDir === "desc" ? " ↓" : " ↑") : ""}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLadderRows.map((r, idx) => {
                        const isBriars = /briars/i.test(r.cols[0] || "");
                        return (
                          <tr key={`${r.team}-${idx}`} className={isBriars ? styles.ladderBriars : ""}>
                            {r.cols.map((c, i) => (
                              <td key={i} className={styles.ladderTd}>{c}</td>
                            ))}
                          </tr>
                        );
                      })}

                      {sortedLadderRows.length === 0 && (
                        <tr>
                          <td className={styles.ladderTd} colSpan={Math.max(ladderHeaders.length, 1)}>
                            Ladder not found on source page (or headers changed).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Past results */}
            <div style={{ marginTop: 18, paddingBottom: 38 }}>
              <div className={styles.sectionTitle} style={{ marginBottom: 10 }}>Past results</div>

              <div className={styles.pastGrid}>
                {past.slice(0, 12).map((g, idx) => {
                  const dt = new Date(g.kickoffISO);
                  return (
                    <div key={idx} className={styles.card}>
                      <div className={styles.cardPad}>
                        <div style={{ fontWeight: 950 }}>{g.home} vs {g.away}</div>
                        <div className={styles.hint} style={{ marginTop: 4 }}>
                          {g.roundLabel ? `${g.roundLabel} • ` : ""}{dt.toLocaleString()} • {g.venue}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <Pill><Trophy size={16} /> Final: <span style={{ color: "var(--text)" }}>{g.score}</span></Pill>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {past.length === 0 && (
                  <div className={`${styles.card} ${styles.cardPad}`}>
                    <div className={styles.sub}>No past games found.</div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
