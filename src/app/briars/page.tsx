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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="card">
      {children}
      <style jsx>{`
        .card{
          border: 1px solid rgba(17,24,39,0.10);
          background: rgba(255,255,255,0.88);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(17,24,39,0.10);
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  );
}

function Pill({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <span className={`pill ${subtle ? "subtle" : ""}`}>
      {children}
      <style jsx>{`
        .pill{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 10px;
          border-radius:999px;
          border:1px solid rgba(17,24,39,0.10);
          background: rgba(17,24,39,0.02);
          color: rgba(17,24,39,0.70);
          font-size:13px;
          font-weight:800;
          white-space:nowrap;
        }
        .pill.subtle{
          background: rgba(17,24,39,0.01);
          color: rgba(17,24,39,0.60);
        }
      `}</style>
    </span>
  );
}

function Button({ children, onClick, kind = "primary" }: { children: React.ReactNode; onClick?: () => void; kind?: "primary"|"soft" }) {
  return (
    <button className={`btn ${kind}`} onClick={onClick}>
      {children}
      <style jsx>{`
        .btn{
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 900;
          cursor: pointer;
          border: 1px solid rgba(17,24,39,0.14);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn.primary{
          background: white;
          box-shadow: 0 4px 18px rgba(17,24,39,0.08);
          color: rgba(17,24,39,0.92);
        }
        .btn.soft{
          background: rgba(17,24,39,0.03);
          border: 1px solid rgba(17,24,39,0.10);
          color: rgba(17,24,39,0.88);
        }
        .btn:active{ transform: translateY(1px); }
      `}</style>
    </button>
  );
}

function Logo({ url }: { url?: string }) {
  return (
    <div className="logo">
      {url ? <img src={url} alt="" /> : <span>—</span>}
      <style jsx>{`
        .logo{
          width:54px;height:54px;
          border-radius:14px;
          border:1px solid rgba(17,24,39,0.10);
          background:white;
          display:grid;
          place-items:center;
          overflow:hidden;
          flex:0 0 auto;
        }
        .logo img{
          width:100%;height:100%;
          object-fit:contain;
          padding:8px;
        }
        .logo span{ color: rgba(17,24,39,0.35); font-weight:900; }
      `}</style>
    </div>
  );
}

export default function BriarsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [countsByKey, setCountsByKey] = useState<Record<string, Counts>>({});
  const [weather, setWeather] = useState<Weather | null>(null);

  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // login / remembered
  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");

  // upcoming display
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  // ladder sorting
  const [ladderSortKey, setLadderSortKey] = useState<string>("PTS");
  const [ladderSortDir, setLadderSortDir] = useState<"desc"|"asc">("desc");

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

  useEffect(() => { loadFixtures(); }, []);

  const { upcoming, past, nextGame } = useMemo(() => {
    const games = data?.games ?? [];
    const u: Game[] = [];
    const p: Game[] = [];
    for (const g of games) {
      const dt = new Date(g.kickoffISO);
      if (dt.getTime() >= now.getTime()) u.push(g);
      else p.push(g);
    }
    u.sort((a,b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime());
    p.sort((a,b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime());
    return { upcoming: u, past: p, nextGame: u[0] || null };
  }, [data, now]);

  // counts
  useEffect(() => {
    (async () => {
      const next: Record<string, Counts> = {};
      for (const g of upcoming.slice(0, 30)) {
        const key = makeSourceKey(g);
        const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(key)}`, { cache: "no-store" });
        const json = await res.json();
        if (json?.ok) next[key] = json.counts;
      }
      setCountsByKey(next);
    })();
  }, [upcoming.length]);

  // weather (next game)
  useEffect(() => {
    (async () => {
      if (!nextGame) return setWeather(null);
      const res = await fetch(`/api/weather/homebush?kickoffISO=${encodeURIComponent(nextGame.kickoffISO)}`, { cache: "no-store" });
      const json = await res.json();
      setWeather(json);
    })();
  }, [nextGame?.kickoffISO]);

  // auto-hide login if ready
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

    const sum = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(source_key)}`, { cache: "no-store" }).then(r => r.json());
    if (sum?.ok) setCountsByKey(prev => ({ ...prev, [source_key]: sum.counts }));
  }

  // ----- LADDER SORTING -----
  const ladder = data?.ladder;
  const ladderHeaders = ladder?.headers || [];
  const ladderRows = ladder?.rows || [];

  // Find important columns by header name (flexible)
  const headerIndex = useMemo(() => {
    const map: Record<string, number> = {};
    ladderHeaders.forEach((h, i) => {
      const key = h.trim().toLowerCase();
      map[key] = i;
    });
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
  const idxGA = findIndexByNames(["ga", "against"]);

  function sortValue(row: { cols: string[] }, key: string) {
    // key matches header label
    const k = key.toLowerCase();
    const idx = headerIndex[k];
    if (typeof idx === "number") return num(row.cols[idx]);
    return 0;
  }

  const sortedLadderRows = useMemo(() => {
    const rows = [...ladderRows];

    // Default: points desc, then GD desc, then GF desc
    rows.sort((a, b) => {
      const aPts = idxPts >= 0 ? num(a.cols[idxPts]) : 0;
      const bPts = idxPts >= 0 ? num(b.cols[idxPts]) : 0;
      if (bPts !== aPts) return bPts - aPts;

      const aGD = idxGD >= 0 ? num(a.cols[idxGD]) : 0;
      const bGD = idxGD >= 0 ? num(b.cols[idxGD]) : 0;
      if (bGD !== aGD) return bGD - aGD;

      const aGF = idxGF >= 0 ? num(a.cols[idxGF]) : 0;
      const bGF = idxGF >= 0 ? num(b.cols[idxGF]) : 0;
      if (bGF !== aGF) return bGF - aGF;

      return String(a.cols[idxTeam]).localeCompare(String(b.cols[idxTeam]));
    });

    // If user clicked a column sort, apply that on top
    if (ladderHeaders.length && ladderSortKey) {
      const keyLower = ladderSortKey.toLowerCase();
      const idx = headerIndex[keyLower];
      if (typeof idx === "number") {
        rows.sort((a, b) => {
          const av = num(a.cols[idx]);
          const bv = num(b.cols[idx]);
          if (av === bv) {
            // keep tie-breaker stable: Pts desc, GD desc
            const aPts = idxPts >= 0 ? num(a.cols[idxPts]) : 0;
            const bPts = idxPts >= 0 ? num(b.cols[idxPts]) : 0;
            if (bPts !== aPts) return bPts - aPts;

            const aGD = idxGD >= 0 ? num(a.cols[idxGD]) : 0;
            const bGD = idxGD >= 0 ? num(b.cols[idxGD]) : 0;
            if (bGD !== aGD) return bGD - aGD;

            return String(a.cols[idxTeam]).localeCompare(String(b.cols[idxTeam]));
          }
          return ladderSortDir === "desc" ? (bv - av) : (av - bv);
        });
      }
    }

    return rows;
  }, [
    ladderRows,
    ladderHeaders.join("|"),
    ladderSortKey,
    ladderSortDir,
    idxPts,
    idxGD,
    idxGF,
    headerIndex,
  ]);

  function onLadderHeaderClick(h: string) {
    const upper = h.toUpperCase();
    if (ladderSortKey === upper) {
      setLadderSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setLadderSortKey(upper);
      setLadderSortDir("desc");
    }
  }

  // ----- UI -----
  const shell = { maxWidth: 1120, margin: "0 auto", padding: 16 };

  const next = nextGame
    ? (() => {
        const dt = new Date(nextGame.kickoffISO);
        const ms = dt.getTime() - now.getTime();
        const counts = countsByKey[makeSourceKey(nextGame)] || { yes: 0, no: 0, maybe: 0 };
        const homeLogo = CLUB_LOGOS[clubKey(nextGame.home)];
        const awayLogo = CLUB_LOGOS[clubKey(nextGame.away)];

        return (
          <Card>
            <div style={{ padding: 16 }}>
              <div className="rowTop">
                <Pill><Trophy size={16} /> Next game</Pill>
                <Pill subtle>Starts in <b style={{ color: "rgba(17,24,39,0.92)" }}>{formatCountdown(ms)}</b></Pill>
              </div>

              <div className="vsGrid">
                <div className="team">
                  <Logo url={homeLogo} />
                  <div>
                    <div className="teamName">{nextGame.home}</div>
                    <div className="sub">Home</div>
                  </div>
                </div>

                <div className="mid">
                  <div className="vs">VS</div>
                  <div className="sub">{nextGame.roundLabel || "Fixture"}</div>
                </div>

                <div className="team right">
                  <div>
                    <div className="teamName">{nextGame.away}</div>
                    <div className="sub">Away</div>
                  </div>
                  <Logo url={awayLogo} />
                </div>
              </div>

              <div className="chips">
                <Pill><CalendarDays size={16} /> {dt.toLocaleDateString()}</Pill>
                <Pill><Clock3 size={16} /> {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Pill>
                <Pill><MapPin size={16} /> {nextGame.venue || "—"}</Pill>
                <Pill><Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}</Pill>

                {/* Weather chip */}
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

              <div className="divider" />

              <details className="details">
                <summary className="summary">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <Users size={18} /> Mark availability
                  </span>
                  <span className="summaryRight">
                    Expand <ChevronDown size={16} />
                  </span>
                </summary>

                <div className="btnRow">
                  <Button onClick={() => setStatus(nextGame, "yes")}>✅ Yes</Button>
                  <Button onClick={() => setStatus(nextGame, "maybe")}>❓ Maybe</Button>
                  <Button onClick={() => setStatus(nextGame, "no")}>❌ No</Button>
                </div>
              </details>
            </div>

            <style jsx>{`
              .rowTop{
                display:flex;
                justify-content:space-between;
                gap:10px;
                flex-wrap:wrap;
                align-items:center;
              }
              .vsGrid{
                display:grid;
                grid-template-columns: 1fr auto 1fr;
                gap:14px;
                align-items:center;
                margin-top:14px;
              }
              .team{
                display:flex;
                gap:12px;
                align-items:center;
              }
              .team.right{
                justify-content:flex-end;
                text-align:right;
              }
              .teamName{
                font-size:18px;
                font-weight:950;
                letter-spacing:-0.2px;
              }
              .mid{
                text-align:center;
                color: rgba(17,24,39,0.65);
                font-weight:900;
              }
              .vs{
                font-size:14px;
                letter-spacing:2px;
              }
              .sub{
                font-size:13px;
                color: rgba(17,24,39,0.45);
                font-weight:800;
                margin-top:2px;
              }
              .chips{
                display:flex;
                flex-wrap:wrap;
                gap:10px;
                margin-top:14px;
              }
              .divider{
                height:1px;
                background: rgba(17,24,39,0.10);
                margin:14px 0;
              }
              .details{
                border:1px solid rgba(17,24,39,0.10);
                background: rgba(17,24,39,0.02);
                border-radius:14px;
                padding:12px;
              }
              .summary{
                cursor:pointer;
                list-style:none;
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                font-weight:950;
              }
              .summaryRight{
                color: rgba(17,24,39,0.55);
                font-weight:850;
                display:inline-flex;
                align-items:center;
                gap:6px;
              }
              .btnRow{
                display:flex;
                gap:10px;
                flex-wrap:wrap;
                margin-top:12px;
              }

              /* Mobile stack for hero */
              @media (max-width: 740px){
                .vsGrid{
                  grid-template-columns: 1fr;
                  gap:12px;
                }
                .mid{ display:none; }
                .team.right{
                  justify-content:flex-start;
                  text-align:left;
                  flex-direction: row-reverse;
                }
              }
            `}</style>
          </Card>
        );
      })()
    : null;

  // Upcoming preview (mobile-friendly cards)
  const upcomingPreview = upcoming.slice(0, 5);
  const upcomingAll = upcoming;

  function GameRowCard({ g }: { g: Game }) {
    const dt = new Date(g.kickoffISO);
    const ms = dt.getTime() - now.getTime();
    const counts = countsByKey[makeSourceKey(g)] || { yes: 0, no: 0, maybe: 0 };
    const homeLogo = CLUB_LOGOS[clubKey(g.home)];
    const awayLogo = CLUB_LOGOS[clubKey(g.away)];

    return (
      <div className="gcard">
        <div className="top">
          <div className="match">
            <Logo url={homeLogo} />
            <span className="vs">vs</span>
            <Logo url={awayLogo} />
            <div className="names">
              <div className="title">{g.home} vs {g.away}</div>
              <div className="sub">{g.roundLabel || "Fixture"}</div>
            </div>
          </div>

          <Pill subtle>{formatCountdown(ms)}</Pill>
        </div>

        <div className="meta">
          <span className="m"><Clock3 size={16} /> {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="m"><MapPin size={16} /> {g.venue || "—"}</span>
        </div>

        <details className="details">
          <summary className="summary">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Users size={16} /> ✅ {counts.yes} ❓ {counts.maybe} ❌ {counts.no}
            </span>
            <ChevronDown size={16} />
          </summary>
          <div className="btns">
            <Button onClick={() => setStatus(g, "yes")}>✅ Yes</Button>
            <Button onClick={() => setStatus(g, "maybe")}>❓ Maybe</Button>
            <Button onClick={() => setStatus(g, "no")}>❌ No</Button>
          </div>
        </details>

        <style jsx>{`
          .gcard{
            border:1px solid rgba(17,24,39,0.10);
            background:white;
            border-radius:16px;
            padding:14px;
            box-shadow: 0 4px 18px rgba(17,24,39,0.06);
          }
          .top{
            display:flex;
            justify-content:space-between;
            gap:12px;
            align-items:flex-start;
            flex-wrap:wrap;
          }
          .match{
            display:flex;
            align-items:center;
            gap:10px;
          }
          .vs{
            font-weight:900;
            color: rgba(17,24,39,0.45);
          }
          .names{ margin-left: 2px; }
          .title{ font-weight:950; letter-spacing:-0.2px; }
          .sub{ font-size:13px; color: rgba(17,24,39,0.45); font-weight:800; margin-top:2px; }
          .meta{
            display:flex;
            gap:14px;
            flex-wrap:wrap;
            margin-top:10px;
            color: rgba(17,24,39,0.70);
            font-weight:800;
            font-size:13px;
          }
          .m{ display:inline-flex; align-items:center; gap:8px; }
          .details{
            margin-top:12px;
            border:1px solid rgba(17,24,39,0.10);
            background: rgba(17,24,39,0.02);
            border-radius:14px;
            padding:10px;
          }
          .summary{
            cursor:pointer;
            list-style:none;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            font-weight:950;
          }
          .btns{
            margin-top:10px;
            display:flex;
            gap:10px;
            flex-wrap:wrap;
          }

          @media (max-width: 560px){
            .match{ align-items:flex-start; }
            .title{ max-width: 220px; }
          }
        `}</style>
      </div>
    );
  }

  const showLogin = !loginComplete;

  return (
    <main>
      <div style={shell}>
        {/* Header */}
        <div className="header">
          <div>
            <div className="h1">Briars Legends</div>
            <div className="sub">
              Last refresh{" "}
              <span className="strong">
                {data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>

          <div className="actions">
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
                    fontWeight: 900,
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

        {loading && <div style={{ color: "rgba(17,24,39,0.60)", fontWeight: 800 }}>Loading…</div>}

        {!loading && (
          <>
            {/* Login (auto-hide) */}
            {showLogin && (
              <Card>
                <div style={{ padding: 16 }}>
                  <div className="loginGrid">
                    <div>
                      <div className="label">Your name</div>
                      <input
                        value={playerName}
                        onChange={(e) => persistName(e.target.value)}
                        onBlur={(e) => persistName(e.target.value)}
                        placeholder="e.g. Joel"
                        className="input"
                      />
                      <div className="hint">Saved automatically on this device.</div>
                    </div>

                    <div>
                      <div className="label">Team PIN</div>
                      {!pinOk ? (
                        <div className="pinRow">
                          <input
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            placeholder="Enter PIN"
                            type="password"
                            className="input"
                          />
                          <Button onClick={rememberPin}>
                            <ShieldCheck size={18} />
                            Remember
                          </Button>
                        </div>
                      ) : (
                        <div className="pinRow">
                          <Pill><ShieldCheck size={16} /> Unlocked on this device</Pill>
                          <Button kind="soft" onClick={logout}>Log out</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <style jsx>{`
                  .loginGrid{
                    display:grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                  }
                  .label{
                    font-size:13px;
                    font-weight:950;
                    color: rgba(17,24,39,0.62);
                    margin-bottom: 8px;
                  }
                  .hint{
                    margin-top:6px;
                    font-size:12px;
                    color: rgba(17,24,39,0.45);
                    font-weight:800;
                  }
                  .pinRow{
                    display:flex;
                    gap:10px;
                    flex-wrap:wrap;
                    align-items:center;
                  }
                  .input{
                    width:100%;
                    padding:12px;
                    border-radius:12px;
                    border:1px solid rgba(17,24,39,0.14);
                    background:white;
                    outline:none;
                    box-shadow: 0 4px 18px rgba(17,24,39,0.06);
                    font-weight:850;
                    color: rgba(17,24,39,0.92);
                  }
                  @media (max-width: 860px){
                    .loginGrid{ grid-template-columns: 1fr; }
                  }
                `}</style>
              </Card>
            )}

            {/* Next game */}
            <div style={{ marginTop: showLogin ? 14 : 0 }}>
              {next}
            </div>

            {/* Upcoming preview + Show all pill */}
            <div style={{ marginTop: 18 }}>
              <div className="sectionTop">
                <div className="sectionTitle">Upcoming fixtures</div>

                <button
                  className="pillBtn"
                  onClick={() => setShowAllUpcoming((v) => !v)}
                >
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

              <div className="grid">
                {(showAllUpcoming ? upcomingAll : upcomingPreview).map((g, i) => (
                  <GameRowCard key={`${g.kickoffISO}-${i}`} g={g} />
                ))}
              </div>

              {upcomingAll.length === 0 && (
                <Card>
                  <div style={{ padding: 14, color: "rgba(17,24,39,0.60)", fontWeight: 850 }}>
                    No upcoming games found.
                  </div>
                </Card>
              )}

              <style jsx>{`
                .sectionTop{
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:12px;
                  flex-wrap:wrap;
                  margin-bottom: 10px;
                }
                .sectionTitle{
                  font-size:18px;
                  font-weight:950;
                  letter-spacing:-0.2px;
                }
                .pillBtn{
                  display:inline-flex;
                  align-items:center;
                  gap:8px;
                  padding: 10px 12px;
                  border-radius:999px;
                  border:1px solid rgba(17,24,39,0.10);
                  background: rgba(17,24,39,0.02);
                  cursor:pointer;
                  font-weight:950;
                  color: rgba(17,24,39,0.74);
                }
                .grid{
                  display:grid;
                  gap: 12px;
                  grid-template-columns: 1fr 1fr;
                }
                @media (max-width: 900px){
                  .grid{ grid-template-columns: 1fr; }
                }
              `}</style>
            </div>

            {/* Ladder */}
            <div style={{ marginTop: 18 }}>
              <div className="sectionTop">
                <div className="sectionTitle">Snr Masters Ladder</div>
                <Pill subtle>
                  Default: Pts ↓ then GD ↓
                </Pill>
              </div>

              <Card>
                <div style={{ overflowX: "auto" }}>
                  <table className="ladder">
                    <thead>
                      <tr>
                        {ladderHeaders.map((h) => {
                          const upper = h.toUpperCase();
                          const isActive = ladderSortKey === upper;
                          return (
                            <th
                              key={h}
                              onClick={() => onLadderHeaderClick(h)}
                              className={isActive ? "active" : ""}
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
                          <tr key={`${r.team}-${idx}`} className={isBriars ? "briars" : ""}>
                            {r.cols.map((c, i) => (
                              <td key={i}>{c}</td>
                            ))}
                          </tr>
                        );
                      })}

                      {sortedLadderRows.length === 0 && (
                        <tr>
                          <td style={{ padding: 14, color: "rgba(17,24,39,0.60)", fontWeight: 850 }} colSpan={Math.max(ladderHeaders.length, 1)}>
                            Ladder not found on source page (or headers changed).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <style jsx>{`
                .sectionTop{
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:12px;
                  flex-wrap:wrap;
                  margin-bottom: 10px;
                }
                .sectionTitle{
                  font-size:18px;
                  font-weight:950;
                  letter-spacing:-0.2px;
                }
                table.ladder{
                  width: 100%;
                  border-collapse: collapse;
                  min-width: 760px;
                }
                .ladder th, .ladder td{
                  padding: 12px 14px;
                  border-bottom: 1px solid rgba(17,24,39,0.08);
                  text-align: left;
                  font-weight: 850;
                  color: rgba(17,24,39,0.84);
                  white-space: nowrap;
                }
                .ladder th{
                  font-size: 12px;
                  text-transform: uppercase;
                  letter-spacing: 0.6px;
                  color: rgba(17,24,39,0.55);
                  cursor: pointer;
                  user-select: none;
                  background: rgba(17,24,39,0.015);
                  position: sticky;
                  top: 0;
                }
                .ladder th.active{
                  color: rgba(17,24,39,0.92);
                }
                .ladder tr.briars td{
                  background: rgba(37,99,235,0.04);
                }
              `}</style>
            </div>

            {/* Past results */}
            <div style={{ marginTop: 18, paddingBottom: 38 }}>
              <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>Past results</div>

              <div className="pastGrid">
                {past.slice(0, 12).map((g, idx) => {
                  const dt = new Date(g.kickoffISO);
                  return (
                    <Card key={idx}>
                      <div style={{ padding: 14 }}>
                        <div style={{ fontWeight: 950 }}>{g.home} vs {g.away}</div>
                        <div style={{ marginTop: 4, color: "rgba(17,24,39,0.50)", fontWeight: 850, fontSize: 13 }}>
                          {g.roundLabel ? `${g.roundLabel} • ` : ""}{dt.toLocaleString()} • {g.venue}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <Pill>
                            <Trophy size={16} /> Final: <span style={{ color: "rgba(17,24,39,0.92)" }}>{g.score}</span>
                          </Pill>
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {past.length === 0 && (
                  <Card>
                    <div style={{ padding: 14, color: "rgba(17,24,39,0.60)", fontWeight: 850 }}>No past games found.</div>
                  </Card>
                )}
              </div>

              <style jsx>{`
                .pastGrid{
                  display:grid;
                  gap:12px;
                  grid-template-columns: 1fr 1fr;
                }
                @media (max-width: 900px){
                  .pastGrid{ grid-template-columns: 1fr; }
                }
              `}</style>
            </div>
          </>
        )}

        <style jsx>{`
          .header{
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:12px;
            flex-wrap:wrap;
            margin: 6px 0 14px;
          }
          .h1{
            font-size:30px;
            font-weight:950;
            letter-spacing:-0.4px;
          }
          .sub{
            margin-top:6px;
            font-size:14px;
            color: rgba(17,24,39,0.60);
            font-weight:850;
          }
          .strong{
            color: rgba(17,24,39,0.92);
            font-weight:950;
          }
          .actions{
            display:flex;
            gap:10px;
            flex-wrap:wrap;
            align-items:center;
          }
        `}</style>
      </div>
    </main>
  );
}
