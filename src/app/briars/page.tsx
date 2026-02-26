"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  CloudSun,
  Droplets,
  LogOut,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
  Wind,
} from "lucide-react";
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
type NamesByStatus = { yes: string[]; maybe: string[]; no: string[] };

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

function parseSourceDate(dateStr: string) {
  const [dd, mm, yyyy] = dateStr.split("/").map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1);
}

function formatDayDateFromSource(dateStr: string) {
  const d = parseSourceDate(dateStr);
  const day = d.toLocaleDateString("en-AU", { weekday: "short" });
  const [dd, mm] = dateStr.split("/");
  return `${day} ${dd}/${mm}`;
}

function formatLongDateFromSource(dateStr: string) {
  const d = parseSourceDate(dateStr);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeFromSource(timeStr: string) {
  const [hour24 = 0, minute = 0] = timeStr.split(":").map(Number);
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function shortTeamName(team: string) {
  return team.trim().split(/\s+/)[0] || team;
}

function num(x: string | undefined) {
  if (!x) return 0;
  const n = Number(String(x).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function Pill({
  children,
  subtle,
  tone = "default",
}: {
  children: React.ReactNode;
  subtle?: boolean;
  tone?: "default" | "gold" | "blue" | "green" | "map";
}) {
  const toneClass =
    tone === "gold"
      ? styles.pillGold
      : tone === "blue"
      ? styles.pillBlue
      : tone === "green"
      ? styles.pillGreen
      : tone === "map"
      ? styles.pillMap
      : "";

  return (
    <span className={`${styles.pill} ${subtle ? styles.pillSubtle : ""} ${toneClass}`}>
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  kind = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "soft";
  disabled?: boolean;
}) {
  return (
    <button
      className={`${styles.btn} ${kind === "primary" ? styles.btnPrimary : styles.btnSoft}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
      style={disabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
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
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const [countsByKey, setCountsByKey] = useState<Record<string, Counts>>({});
  const [namesByKey, setNamesByKey] = useState<Record<string, NamesByStatus>>({});
  const [myStatusByKey, setMyStatusByKey] = useState<Record<string, "yes" | "no" | "maybe">>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [ladderSortKey, setLadderSortKey] = useState("PTS");
  const [ladderSortDir, setLadderSortDir] = useState<"asc" | "desc">("desc");
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
    setPlayerName(localStorage.getItem(LS_PLAYER_NAME) || "");
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/briars-fixtures", { cache: "no-store" });
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    })();
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

  async function loadNames(sourceKey: string) {
    try {
      const res = await fetch(`/api/availability/names?source_key=${encodeURIComponent(sourceKey)}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setNamesByKey((prev) => ({ ...prev, [sourceKey]: json.names as NamesByStatus }));
      }
    } catch {
      //
    }
  }

  useEffect(() => {
    (async () => {
      const next: Record<string, Counts> = {};
      for (const g of upcoming.slice(0, 30)) {
        const key = makeSourceKey(g);
        try {
          const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(key)}`, { cache: "no-store" });
          const json = await res.json();
          if (json?.ok) next[key] = json.counts;
        } catch {
          //
        }
      }
      setCountsByKey(next);
    })();
  }, [upcoming.length]);

  useEffect(() => {
    (async () => {
      const targets = [nextGame, ...upcoming.slice(0, 4)].filter(Boolean) as Game[];
      for (const g of targets) {
        await loadNames(makeSourceKey(g));
      }
    })();
  }, [nextGame?.kickoffISO, upcoming.length]);

  useEffect(() => {
    (async () => {
      if (!nextGame) return setWeather(null);
      try {
        const res = await fetch(`/api/weather/homebush?kickoffISO=${encodeURIComponent(nextGame.kickoffISO)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        setWeather(json);
      } catch {
        setWeather(null);
      }
    })();
  }, [nextGame?.kickoffISO]);

  const loginComplete = useMemo(() => {
    return pinOk && playerName.trim().length >= 2;
  }, [pinOk, playerName]);

  function persistName(next: string) {
    setPlayerName(next);
    const n = next.trim();
    if (n.length >= 2) localStorage.setItem(LS_PLAYER_NAME, n);
  }

  function flash(msg: string, ms = 1800) {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  }

  function rememberPin() {
    if (pinInput.trim() !== "briars2026") {
      flash("Wrong PIN", 2200);
      return;
    }
    localStorage.setItem(LS_PIN_OK, "1");
    localStorage.setItem(LS_TEAM_PIN, "briars2026");
    setPinOk(true);
    setPinInput("");
    flash("PIN saved ✓", 2000);
  }

  function logout() {
    localStorage.removeItem(LS_PIN_OK);
    localStorage.removeItem(LS_TEAM_PIN);
    setPinOk(false);
    flash("Logged out", 1600);
  }

  async function setStatus(g: Game, status: "yes" | "no" | "maybe") {
    if (!pinOk) return flash("Enter the team PIN first.", 2500);
    const n = playerName.trim();
    if (n.length < 2) return flash("Enter your name first.", 2500);

    const source_key = makeSourceKey(g);
    setSavingKey(source_key);

    try {
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
      if (!json?.ok) throw new Error(json?.error || "Failed to save");

      setMyStatusByKey((prev) => ({ ...prev, [source_key]: status }));
      flash("Saved ✓");

      const sum = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(source_key)}`, {
        cache: "no-store",
      }).then((r) => r.json());

      if (sum?.ok) setCountsByKey((prev) => ({ ...prev, [source_key]: sum.counts }));

      await loadNames(source_key);
    } catch (e: any) {
      flash(e?.message || "Something went wrong", 3000);
    } finally {
      setSavingKey(null);
    }
  }

  const ladder = data?.ladder;
  const ladderHeaders = ladder?.headers || [];
  const ladderRows = ladder?.rows || [];

  const headerIndex = useMemo(() => {
    const map: Record<string, number> = {};
    ladderHeaders.forEach((h, i) => {
      map[h.trim().toLowerCase()] = i;
    });
    return map;
  }, [ladderHeaders]);

  const sortedLadderRows = useMemo(() => {
    const rows = [...ladderRows];
    if (!ladderSortKey) return rows;

    const idx = headerIndex[ladderSortKey.toLowerCase()];
    if (typeof idx !== "number") return rows;

    rows.sort((a, b) => {
      const av = num(a.cols[idx]);
      const bv = num(b.cols[idx]);

      if (av === bv) {
        return String(a.cols[0] || "").localeCompare(String(b.cols[0] || ""));
      }

      return ladderSortDir === "desc" ? bv - av : av - bv;
    });

    return rows;
  }, [ladderRows, ladderSortKey, ladderSortDir, headerIndex]);

  const upcomingPreview = upcoming.slice(0, 4);
  const upcomingList = showAllUpcoming ? upcoming : upcomingPreview;

  function AvailabilityBlock({ g }: { g: Game }) {
    const key = makeSourceKey(g);
    const names = namesByKey[key] || { yes: [], maybe: [], no: [] };
    const counts = countsByKey[key] || { yes: 0, maybe: 0, no: 0 };
    const mine = myStatusByKey[key];
    const saving = savingKey === key;

    return (
      <div className={styles.availabilityBox}>
        <div className={styles.availabilityTop}>
          <div className={styles.availabilityTitle}>Availability</div>
          <Pill tone="gold">
            <Users size={15} /> ✅ {counts.yes} / ❓ {counts.maybe} / ❌ {counts.no}
          </Pill>
        </div>

        <div className={styles.statusLine}>
          Your status:{" "}
          <span className={styles.statusStrong}>
            {mine === "yes" ? "In" : mine === "maybe" ? "Maybe" : mine === "no" ? "Out" : "Not set"}
            {saving ? " (saving…)" : ""}
          </span>
        </div>

        <div className={styles.btnRow}>
          <Button onClick={() => setStatus(g, "yes")} disabled={saving}>
            ✅ I’m in
          </Button>
          <Button onClick={() => setStatus(g, "maybe")} kind="soft" disabled={saving}>
            ❓ Maybe
          </Button>
          <Button onClick={() => setStatus(g, "no")} kind="soft" disabled={saving}>
            ❌ Out
          </Button>
        </div>

        <div className={styles.availabilityNamesGrid}>
          <div className={styles.nameCol}>
            <div className={styles.nameColTitle}>✅ In</div>
            <div className={styles.nameColBody}>{names.yes.length ? names.yes.join(", ") : "—"}</div>
          </div>
          <div className={styles.nameCol}>
            <div className={styles.nameColTitle}>❓ Maybe</div>
            <div className={styles.nameColBody}>{names.maybe.length ? names.maybe.join(", ") : "—"}</div>
          </div>
          <div className={styles.nameCol}>
            <div className={styles.nameColTitle}>❌ Out</div>
            <div className={styles.nameColBody}>{names.no.length ? names.no.join(", ") : "—"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <div className={styles.h1}>Briars Fixtures</div>
          <div className={styles.sub}>
            Source: <span className={styles.strong}>Sydney Men’s Hockey</span>
            {data?.refreshedAt ? ` • Refreshed ${new Date(data.refreshedAt).toLocaleString("en-AU")}` : ""}
          </div>
        </div>

        <div className={styles.actions}>
          {toast ? <div className={styles.toast}>{toast}</div> : null}
          {pinOk ? (
            <Button kind="soft" onClick={logout}>
              <LogOut size={16} /> Log out
            </Button>
          ) : null}
        </div>
      </div>

      {!loginComplete ? (
        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 16 }}>
          <div className={styles.sectionTitle}>Team access</div>
          <div className={styles.loginGrid} style={{ marginTop: 12 }}>
            <div>
              <div className={styles.label}>Team PIN</div>
              <div className={styles.pinRow}>
                <input
                  className={styles.input}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter team PIN"
                />
                <Button onClick={rememberPin}>
                  <ShieldCheck size={16} /> Save PIN
                </Button>
              </div>
            </div>

            <div>
              <div className={styles.label}>Your name</div>
              <input
                className={styles.input}
                value={playerName}
                onChange={(e) => persistName(e.target.value)}
                placeholder="e.g. Joel"
              />
              <div className={styles.hint}>Needed so everyone can see who’s in / out / maybe.</div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className={`${styles.card} ${styles.cardPad}`}>Loading fixtures…</div>
      ) : null}

      {!loading && nextGame ? (
        <div className={`${styles.card} ${styles.cardPad} ${styles.nextGameCard}`}>
          <div className={styles.rowTop}>
            <Pill tone="gold">
              <Trophy size={16} /> Next game
            </Pill>

            <Pill tone="blue">
              Starts in <b style={{ color: "var(--text)" }}>{formatCountdown(new Date(nextGame.kickoffISO).getTime() - now.getTime())}</b>
            </Pill>
          </div>

          <div className={styles.vsGrid}>
            <div className={styles.team}>
              <Logo url={CLUB_LOGOS[clubKey(nextGame.home)]} />
              <div>
                <div className={styles.teamName}>{nextGame.home}</div>
                <div className={styles.subMini}>Home</div>
              </div>
            </div>

            <div className={styles.mid}>
              <div className={styles.vs}>VS</div>
              <div className={styles.subMini}>{nextGame.roundLabel || "Upcoming fixture"}</div>
            </div>

            <div className={`${styles.team} ${styles.teamRight}`}>
              <div>
                <div className={styles.teamName}>{nextGame.away}</div>
                <div className={styles.subMini}>Away</div>
              </div>
              <Logo url={CLUB_LOGOS[clubKey(nextGame.away)]} />
            </div>
          </div>

          <div className={styles.chips}>
            <Pill tone="blue">
              <CalendarDays size={16} /> {formatDayDateFromSource(nextGame.date)}
            </Pill>
            <Pill tone="green">
              <Clock3 size={16} /> {formatTimeFromSource(nextGame.time)}
            </Pill>
            <Pill tone="map">
              <MapPin size={16} /> {nextGame.venue || "—"}
            </Pill>
          </div>

          {weather?.ok ? (
            <div className={styles.weatherRow}>
              <Pill subtle>
                <CloudSun size={15} /> {typeof weather.tempC === "number" ? `${weather.tempC}°C` : "—"}
              </Pill>
              <Pill subtle>
                <Droplets size={15} /> {typeof weather.precipMM === "number" ? `${weather.precipMM}mm` : "—"}
              </Pill>
              <Pill subtle>
                <Wind size={15} /> {typeof weather.windKmh === "number" ? `${weather.windKmh}km/h` : "—"}
              </Pill>
            </div>
          ) : null}

          <div className={styles.divider} />

          <AvailabilityBlock g={nextGame} />
        </div>
      ) : null}

      {!loading && upcoming.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div className={styles.sectionTop}>
            <div className={styles.sectionTitle}>Upcoming fixtures</div>

            <button className={styles.pillBtn} type="button" onClick={() => setShowAllUpcoming((v) => !v)}>
              {showAllUpcoming ? (
                <>
                  Show next 4 <ChevronUp size={16} />
                </>
              ) : (
                <>
                  Show all <ChevronDown size={16} />
                </>
              )}
            </button>
          </div>

          <div className={styles.grid}>
            {upcomingList.map((g) => {
              const key = makeSourceKey(g);
              const counts = countsByKey[key] || { yes: 0, maybe: 0, no: 0 };
              const ms = new Date(g.kickoffISO).getTime() - now.getTime();

              return (
                <div key={key} className={styles.gcard}>
                  <div className={styles.gTop}>
                    <div className={styles.gMatch}>
                      <Logo url={CLUB_LOGOS[clubKey(g.home)]} />
                      <div className={styles.gVs}>vs</div>
                      <Logo url={CLUB_LOGOS[clubKey(g.away)]} />
                    </div>

                    <Pill tone="blue">{formatCountdown(ms)}</Pill>
                  </div>

                  <div className={styles.gNames}>
                    <div className={styles.gTitle}>
                      {shortTeamName(g.home)} v {shortTeamName(g.away)}
                    </div>
                    <div className={styles.gSub}>{g.roundLabel || "Fixture"}</div>
                  </div>

                  <div className={styles.gMeta}>
                    <span className={styles.gMetaItem}>
                      <CalendarDays size={14} /> {formatDayDateFromSource(g.date)}
                    </span>
                    <span className={styles.gMetaItem}>
                      <Clock3 size={14} /> {formatTimeFromSource(g.time)}
                    </span>
                    <span className={styles.gMetaItem}>
                      <MapPin size={14} /> {g.venue || "—"}
                    </span>
                  </div>

                  <AvailabilityBlock g={g} />

                  <div style={{ marginTop: 12 }}>
                    <Pill tone="gold">
                      <Users size={15} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}
                    </Pill>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && ladderHeaders.length > 0 && sortedLadderRows.length > 0 ? (
        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginTop: 18 }}>
          <div className={styles.sectionTitle}>Ladder</div>

          <div className={styles.ladderWrap}>
            <table className={styles.ladder}>
              <thead>
                <tr>
                  {ladderHeaders.map((h) => {
                    const active = ladderSortKey.toLowerCase() === h.toLowerCase();
                    return (
                      <th
                        key={h}
                        className={`${styles.ladderTh} ${active ? styles.ladderThActive : ""}`}
                        onClick={() => {
                          if (active) {
                            setLadderSortDir((d) => (d === "desc" ? "asc" : "desc"));
                          } else {
                            setLadderSortKey(h);
                            setLadderSortDir("desc");
                          }
                        }}
                      >
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedLadderRows.map((row, idx) => {
                  const isBriars = String(row.team).toLowerCase().includes("briars");
                  return (
                    <tr key={`${row.team}-${idx}`} className={isBriars ? styles.ladderBriars : ""}>
                      {row.cols.map((cell, i) => (
                        <td key={`${idx}-${i}`} className={styles.ladderTd}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && past.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div className={styles.sectionTop}>
            <div className={styles.sectionTitle}>Past results</div>
          </div>

          <div className={styles.pastGrid}>
            {past.slice(0, 8).map((g) => (
              <div key={makeSourceKey(g)} className={styles.gcard}>
                <div className={styles.gTitle}>
                  {shortTeamName(g.home)} v {shortTeamName(g.away)}
                </div>
                <div className={styles.gSub}>{formatLongDateFromSource(g.date)}</div>

                <div className={styles.gMeta}>
                  <span className={styles.gMetaItem}>
                    <Clock3 size={14} /> {formatTimeFromSource(g.time)}
                  </span>
                  <span className={styles.gMetaItem}>
                    <MapPin size={14} /> {g.venue || "—"}
                  </span>
                  <span className={styles.gMetaItem}>
                    <Trophy size={14} /> {g.score || "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
