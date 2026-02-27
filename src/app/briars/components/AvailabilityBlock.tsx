"use client";
import styles from "../availability.module.css";
import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import styles from "../briars.module.css";
import type { Counts, Game, NamesByStatus } from "../page";

const LS_PIN_OK = "briars_pin_ok";
const LS_PLAYER_NAME = "briars_player_name";
const LS_TEAM_PIN = "briars_team_pin";

function makeSourceKey(g: Game) {
  return `${g.date}|${g.time}|${g.home}|${g.away}|${g.venue}`;
}
function makeLegacySourceKey(g: Game) {
  return `${g.kickoffISO}|${g.home}|${g.away}`;
}

function normaliseName(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function statusFromNames(names: NamesByStatus, playerName: string): "yes" | "maybe" | "no" | undefined {
  const needle = normaliseName(playerName);
  if (!needle) return undefined;
  if (names.yes.some((n) => normaliseName(n) === needle)) return "yes";
  if (names.maybe.some((n) => normaliseName(n) === needle)) return "maybe";
  if (names.no.some((n) => normaliseName(n) === needle)) return "no";
  return undefined;
}
function mergeUnique(a: string[], b: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a, ...b]) {
    const k = normaliseName(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
function mergeNames(a?: Partial<NamesByStatus>, b?: Partial<NamesByStatus>): NamesByStatus {
  return {
    yes: mergeUnique(a?.yes || [], b?.yes || []),
    maybe: mergeUnique(a?.maybe || [], b?.maybe || []),
    no: mergeUnique(a?.no || [], b?.no || []),
  };
}
function mergeCounts(a?: Partial<Counts>, b?: Partial<Counts>): Counts {
  return {
    yes: (a?.yes || 0) + (b?.yes || 0),
    maybe: (a?.maybe || 0) + (b?.maybe || 0),
    no: (a?.no || 0) + (b?.no || 0),
  };
}

async function fetchSummary(sourceKey: string) {
  try {
    const res = await fetch(`/api/availability/summary?source_key=${encodeURIComponent(sourceKey)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json?.ok) return json.counts as Counts;
  } catch {}
  return undefined;
}
async function fetchNames(sourceKey: string) {
  try {
    const res = await fetch(`/api/availability/names?source_key=${encodeURIComponent(sourceKey)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json?.ok) return json.names as NamesByStatus;
  } catch {}
  return undefined;
}

function statusLabel(s?: "yes" | "maybe" | "no") {
  if (s === "yes") return "You’re in";
  if (s === "maybe") return "You’re maybe";
  if (s === "no") return "You’re out";
  return "Set your status";
}

export default function AvailabilityBlock({
  game,
  onToast,
}: {
  game: Game;
  onToast?: (msg: string) => void;
}) {
  const key = useMemo(() => makeSourceKey(game), [game]);
  const legacyKey = useMemo(() => makeLegacySourceKey(game), [game]);

  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [saving, setSaving] = useState<null | "yes" | "maybe" | "no">(null);

  const [counts, setCounts] = useState<Counts>({ yes: 0, maybe: 0, no: 0 });
  const [names, setNames] = useState<NamesByStatus>({ yes: [], maybe: [], no: [] });
  const [myStatus, setMyStatus] = useState<"yes" | "maybe" | "no" | undefined>(undefined);

  function toast(msg: string, ms = 1800) {
    onToast?.(msg);
    if (!onToast) void ms;
  }

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
    setPlayerName(localStorage.getItem(LS_PLAYER_NAME) || "");
  }, []);

  useEffect(() => {
    (async () => {
      const [stableCounts, legacyCounts, stableNames, legacyNames] = await Promise.all([
        fetchSummary(key),
        legacyKey !== key ? fetchSummary(legacyKey) : Promise.resolve(undefined),
        fetchNames(key),
        legacyKey !== key ? fetchNames(legacyKey) : Promise.resolve(undefined),
      ]);

      const mergedNames = mergeNames(stableNames, legacyNames);
      const mergedCounts =
        mergedNames.yes.length || mergedNames.maybe.length || mergedNames.no.length
          ? { yes: mergedNames.yes.length, maybe: mergedNames.maybe.length, no: mergedNames.no.length }
          : mergeCounts(stableCounts, legacyCounts);

      setNames(mergedNames);
      setCounts(mergedCounts);

      const mine = statusFromNames(mergedNames, playerName);
      setMyStatus(mine);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, legacyKey]);

  useEffect(() => {
    const n = playerName.trim();
    if (n.length >= 2) localStorage.setItem(LS_PLAYER_NAME, n);
  }, [playerName]);

  function rememberPin() {
    if (pinInput.trim() !== "briars2026") {
      toast("Wrong PIN", 2200);
      return;
    }
    localStorage.setItem(LS_PIN_OK, "1");
    localStorage.setItem(LS_TEAM_PIN, "briars2026");
    setPinOk(true);
    setPinInput("");
    toast("PIN saved ✓", 2000);
  }

  async function setStatus(status: "yes" | "maybe" | "no") {
    if (!pinOk) return toast("Enter the team PIN first.", 2500);
    const n = playerName.trim();
    if (n.length < 2) return toast("Enter your name first.", 2500);

    setSaving(status);

    try {
      const res = await fetch("/api/availability/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: localStorage.getItem(LS_TEAM_PIN) || "",
          playerName: n,
          status,
          game: {
            source_key: key,
            legacy_source_key: legacyKey,
            kickoff_iso: game.kickoffISO,
            home: game.home,
            away: game.away,
            venue: game.venue,
            date: game.date,
            time: game.time,
          },
        }),
      });

      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Failed to save");

      toast("Saved ✓");
      setMyStatus(status);

      const [stableNames, legacyNames] = await Promise.all([
        fetchNames(key),
        legacyKey !== key ? fetchNames(legacyKey) : Promise.resolve(undefined),
      ]);
      const mergedNames = mergeNames(stableNames, legacyNames);
      setNames(mergedNames);
      setCounts({ yes: mergedNames.yes.length, maybe: mergedNames.maybe.length, no: mergedNames.no.length });
    } catch (e: any) {
      toast(e?.message || "Something went wrong", 3000);
    } finally {
      setSaving(null);
    }
  }

  const responses = counts.yes + counts.maybe + counts.no;

  return (
    <section className={styles.availabilityBox} aria-label="Availability">
      {!pinOk || !playerName.trim() ? (
        <div className={styles.availGate}>
          <div className={styles.availGateTitle}>Quick check-in</div>

          <div className={styles.loginGrid}>
            <div>
              <div className={styles.label}>Your name</div>
              <input
                className={styles.input}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div>
              <div className={styles.label}>Team PIN</div>
              <div className={styles.inlineRow}>
                <input
                  className={styles.input}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter team PIN"
                  inputMode="text"
                />
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={rememberPin}>
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className={styles.availHint}>Your name + PIN are saved on this device for next time.</div>
        </div>
      ) : null}

      <div className={styles.availabilityHeader}>
        <div className={styles.availLeft}>
          <div className={styles.eyebrow}>Availability</div>
          <div className={styles.availabilityTitle}>
            {statusLabel(myStatus)}
            {saving ? <span className={styles.availSaving}> • saving…</span> : null}
          </div>
        </div>

        <div className={styles.countsGrid} aria-label="Squad totals">
          <div className={`${styles.countCard} ${styles.countYes}`}>
            <div className={styles.countTop}>
              <span className={styles.countIcon}>✅</span>
              <span className={styles.countLabel}>In</span>
            </div>
            <div className={styles.countNum}>{counts.yes}</div>
          </div>

          <div className={`${styles.countCard} ${styles.countMaybe}`}>
            <div className={styles.countTop}>
              <span className={styles.countIcon}>❓</span>
              <span className={styles.countLabel}>Maybe</span>
            </div>
            <div className={styles.countNum}>{counts.maybe}</div>
          </div>

          <div className={`${styles.countCard} ${styles.countNo}`}>
            <div className={styles.countTop}>
              <span className={styles.countIcon}>❌</span>
              <span className={styles.countLabel}>Out</span>
            </div>
            <div className={styles.countNum}>{counts.no}</div>
          </div>
        </div>
      </div>

      <div className={styles.availSeg} role="group" aria-label="Set your availability">
        <button
          className={`${styles.availSegBtn} ${myStatus === "yes" ? styles.availSegBtnActive : ""}`}
          type="button"
          onClick={() => setStatus("yes")}
          disabled={!!saving}
        >
          <span className={styles.availSegIcon}>✅</span>
          <span className={styles.availSegText}>I’m in</span>
          {myStatus === "yes" ? <span className={styles.availSegTick}>Selected</span> : null}
        </button>

        <button
          className={`${styles.availSegBtn} ${myStatus === "maybe" ? styles.availSegBtnActive : ""}`}
          type="button"
          onClick={() => setStatus("maybe")}
          disabled={!!saving}
        >
          <span className={styles.availSegIcon}>❓</span>
          <span className={styles.availSegText}>Maybe</span>
          {myStatus === "maybe" ? <span className={styles.availSegTick}>Selected</span> : null}
        </button>

        <button
          className={`${styles.availSegBtn} ${myStatus === "no" ? styles.availSegBtnActive : ""}`}
          type="button"
          onClick={() => setStatus("no")}
          disabled={!!saving}
        >
          <span className={styles.availSegIcon}>❌</span>
          <span className={styles.availSegText}>Out</span>
          {myStatus === "no" ? <span className={styles.availSegTick}>Selected</span> : null}
        </button>
      </div>

      <details className={styles.details}>
        <summary className={styles.summary}>
          <span>View squad status</span>
          <span className={styles.summaryRight}>
            <Users size={15} /> {responses} response{responses === 1 ? "" : "s"}
          </span>
        </summary>

        <div className={styles.detailsBody}>
          <div className={styles.availabilityNamesGrid}>
            <div>
              <div className={styles.nameColTitle}>✅ In</div>
              <div className={styles.nameColBody}>{names.yes.length ? names.yes.join(", ") : "—"}</div>
            </div>
            <div>
              <div className={styles.nameColTitle}>❓ Maybe</div>
              <div className={styles.nameColBody}>{names.maybe.length ? names.maybe.join(", ") : "—"}</div>
            </div>
            <div>
              <div className={styles.nameColTitle}>❌ Out</div>
              <div className={styles.nameColBody}>{names.no.length ? names.no.join(", ") : "—"}</div>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
