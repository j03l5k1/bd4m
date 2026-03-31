"use client";

import { useEffect, useMemo, useState } from "react";
import { FiUsers } from "react-icons/fi";
import ui from "../briars.module.css";
import styles from "../availability.module.css";
import type { Counts, Game, NamesByStatus } from "../page";

const LS_PIN_OK = "briars_pin_ok";
const LS_PLAYER_NAME = "briars_player_name";
const LS_TEAM_PIN = "briars_team_pin";
const EMPTY_COUNTS: Counts = { yes: 0, maybe: 0, no: 0 };
const EMPTY_NAMES: NamesByStatus = { yes: [], maybe: [], no: [] };

function makeSourceKey(g: Game) {
  return `${g.date}|${g.time}|${g.home}|${g.away}|${g.venue}`;
}

function makeLegacySourceKey(g: Game) {
  return `${g.kickoffISO}|${g.home}|${g.away}`;
}

function normaliseName(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function capitaliseNameInput(raw: string): string {
  return raw
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function cap(word: string) {
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;
}

function truncateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return cap(parts[0] ?? name);
  return `${cap(parts[0])} ${cap(parts[parts.length - 1])[0]}`;
}

function statusFromNames(
  names: NamesByStatus,
  playerName: string
): "yes" | "maybe" | "no" | undefined {
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

function mergeNames(
  a?: Partial<NamesByStatus>,
  b?: Partial<NamesByStatus>
): NamesByStatus {
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

type CountsResult = { ok: true; counts: Counts } | { ok: false };
type NamesResult = { ok: true; names: NamesByStatus } | { ok: false };

async function fetchMyStatusFromAPI(sourceKey: string, playerName: string) {
  try {
    const res = await fetch(
      `/api/availability/my-status?source_key=${encodeURIComponent(sourceKey)}&playerName=${encodeURIComponent(playerName)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (json?.ok) return (json.status ?? null) as "yes" | "maybe" | "no" | null;
  } catch {}
  return undefined;
}

async function fetchSummary(sourceKey: string) {
  try {
    const res = await fetch(
      `/api/availability/summary?source_key=${encodeURIComponent(sourceKey)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (json?.ok) return { ok: true, counts: json.counts as Counts } satisfies CountsResult;
  } catch {}
  return { ok: false } satisfies CountsResult;
}

async function fetchNames(sourceKey: string) {
  try {
    const res = await fetch(
      `/api/availability/names?source_key=${encodeURIComponent(sourceKey)}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (json?.ok) return { ok: true, names: json.names as NamesByStatus } satisfies NamesResult;
  } catch {}
  return { ok: false } satisfies NamesResult;
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
  onStatusHintChange,
}: {
  game: Game;
  onToast?: (msg: string) => void;
  onStatusHintChange?: (hint: string) => void;
}) {
  const key = useMemo(() => makeSourceKey(game), [game]);
  const legacyKey = useMemo(() => makeLegacySourceKey(game), [game]);

  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [saving, setSaving] = useState<null | "yes" | "maybe" | "no">(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [names, setNames] = useState<NamesByStatus>(EMPTY_NAMES);
  const [myStatus, setMyStatus] = useState<
    "yes" | "maybe" | "no" | undefined
  >(undefined);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isNamesLoading, setIsNamesLoading] = useState(true);
  const [summaryLoadFailed, setSummaryLoadFailed] = useState(false);
  const [namesLoadFailed, setNamesLoadFailed] = useState(false);

  function toast(msg: string, ms = 1800) {
    onToast?.(msg);
    if (!onToast) void ms;
  }

  useEffect(() => {
    setPinOk(localStorage.getItem(LS_PIN_OK) === "1");
    setPlayerName(localStorage.getItem(LS_PLAYER_NAME) || "");
  }, []);

  // Fast: fetch summary counts without blocking the rest of the card.
  useEffect(() => {
    let cancelled = false;
    setIsSummaryLoading(true);
    setSummaryLoadFailed(false);

    (async () => {
      const summary = await fetchSummary(key);

      if (cancelled) return;

      if (summary.ok) {
        setCounts(summary.counts);
      } else {
        setCounts(EMPTY_COUNTS);
        setSummaryLoadFailed(true);
      }

      setIsSummaryLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, reloadTick]);

  // Personal status is a small request, so keep it separate from squad loading.
  useEffect(() => {
    let cancelled = false;
    const name = playerName.trim();
    setMyStatus(undefined);

    if (name.length < 2) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const statusResult = await fetchMyStatusFromAPI(key, name);
      if (cancelled) return;
      if (statusResult !== undefined) setMyStatus(statusResult ?? undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, playerName, reloadTick]);

  // Slower: load all names for squad view and keep layout stable while it arrives.
  useEffect(() => {
    let cancelled = false;
    setIsNamesLoading(true);
    setNamesLoadFailed(false);
    setNames(EMPTY_NAMES);

    (async () => {
      const namesResult = await fetchNames(key);

      if (cancelled) return;

      if (namesResult.ok) {
        setNames(namesResult.names);
        setCounts({
          yes: namesResult.names.yes.length,
          maybe: namesResult.names.maybe.length,
          no: namesResult.names.no.length,
        });
      } else {
        setNames(EMPTY_NAMES);
        setNamesLoadFailed(true);
      }

      setIsNamesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, reloadTick]);

  useEffect(() => {
    const name = playerName.trim();
    if (name.length < 2) return;

    const derived = statusFromNames(names, name);
    if (derived !== undefined) setMyStatus(derived);
  }, [names, playerName]);

  useEffect(() => {
    const n = playerName.trim();
    if (n.length >= 2) localStorage.setItem(LS_PLAYER_NAME, n);
  }, [playerName]);

  useEffect(() => {
    const nameReady = playerName.trim().length >= 2;

    if (!pinOk || !nameReady) {
      onStatusHintChange?.("Set name + PIN");
      return;
    }

    if (myStatus === "yes") {
      onStatusHintChange?.("You’re in");
      return;
    }
    if (myStatus === "maybe") {
      onStatusHintChange?.("You’re maybe");
      return;
    }
    if (myStatus === "no") {
      onStatusHintChange?.("You’re out");
      return;
    }

    onStatusHintChange?.("Not set");
  }, [pinOk, playerName, myStatus, onStatusHintChange]);

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
      setIsNamesLoading(true);
      setNamesLoadFailed(false);

      const namesResult = await fetchNames(key);

      if (namesResult.ok) {
        setNames(namesResult.names);
        setCounts({
          yes: namesResult.names.yes.length,
          maybe: namesResult.names.maybe.length,
          no: namesResult.names.no.length,
        });
      } else {
        setNames(EMPTY_NAMES);
        setNamesLoadFailed(true);
        setReloadTick((value) => value + 1);
      }
    } catch (e: any) {
      toast(e?.message || "Something went wrong", 3000);
    } finally {
      setIsNamesLoading(false);
      setSaving(null);
    }
  }

  function retrySquadLoad() {
    setReloadTick((value) => value + 1);
  }

  const responses = counts.yes + counts.maybe + counts.no;
  const showCountLoading = isNamesLoading && (isSummaryLoading || summaryLoadFailed);
  const squadSummaryText = showCountLoading
    ? "Loading squad status..."
    : namesLoadFailed && summaryLoadFailed
      ? "Couldn’t load squad status"
      : isNamesLoading
        ? `${responses} response${responses === 1 ? "" : "s"} • loading names...`
        : `${responses} response${responses === 1 ? "" : "s"}`;

  return (
    <section
      className={styles.availabilityBox}
      aria-label="Availability"
      aria-busy={isSummaryLoading || isNamesLoading}
    >
      {!pinOk || !playerName.trim() ? (
        <div className={styles.availGate}>
          <div className={styles.availGateTitle}>Quick check-in</div>

          <div className={styles.loginGrid}>
            <div>
              <div className={ui.label}>Your name</div>
              <input
                className={ui.input}
                value={playerName}
                onChange={(e) => setPlayerName(capitaliseNameInput(e.target.value))}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div>
              <div className={ui.label}>Team PIN</div>
              <div className={ui.inlineRow}>
                <input
                  className={ui.input}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter team PIN"
                  inputMode="text"
                />
                <button
                  className={`${ui.btn} ${ui.btnPrimary}`}
                  type="button"
                  onClick={rememberPin}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className={styles.availHint}>
            Your name + PIN are saved on this device for next time.
          </div>
        </div>
      ) : null}

      <div className={styles.availabilityHeader}>
        <div className={styles.availLeft}>
          <div className={ui.eyebrow}>Availability</div>
          <div className={styles.availabilityTitle}>
            {statusLabel(myStatus)}
            {saving ? (
              <span className={styles.availSaving}> • saving…</span>
            ) : null}
          </div>
        </div>

        <div className={styles.countsGrid} aria-label="Squad totals">
          <div className={`${styles.countCard} ${styles.countYes}`}>
            <div className={styles.countTop}>
              <span className={styles.countIcon}>✅</span>
              <span className={styles.countLabel}>In</span>
            </div>
            <div className={styles.countNum}>
              {showCountLoading ? (
                <span className={`${styles.countSkeleton} ${styles.skeletonLine}`} />
              ) : (
                counts.yes
              )}
            </div>
          </div>

          <div className={`${styles.countCard} ${styles.countMaybe}`}>
            <div className={styles.countTop}>
              <span className={styles.countIcon}>🤷</span>
              <span className={styles.countLabel}>Maybe</span>
            </div>
            <div className={styles.countNum}>
              {showCountLoading ? (
                <span className={`${styles.countSkeleton} ${styles.skeletonLine}`} />
              ) : (
                counts.maybe
              )}
            </div>
          </div>

          <div className={`${styles.countCard} ${styles.countNo}`}>
            <div className={styles.countTop}>
              <span className={styles.countIcon}>💩</span>
              <span className={styles.countLabel}>Out</span>
            </div>
            <div className={styles.countNum}>
              {showCountLoading ? (
                <span className={`${styles.countSkeleton} ${styles.skeletonLine}`} />
              ) : (
                counts.no
              )}
            </div>
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
          <span className={styles.availSegIcon}>🤷</span>
          <span className={styles.availSegText}>Maybe</span>
          {myStatus === "maybe" ? <span className={styles.availSegTick}>Selected</span> : null}
        </button>

        <button
          className={`${styles.availSegBtn} ${myStatus === "no" ? styles.availSegBtnActive : ""}`}
          type="button"
          onClick={() => setStatus("no")}
          disabled={!!saving}
        >
          <span className={styles.availSegIcon}>💩</span>
          <span className={styles.availSegText}>Out</span>
          {myStatus === "no" ? <span className={styles.availSegTick}>Selected</span> : null}
        </button>
      </div>

      <details className={ui.details} open>
        <summary className={ui.summary}>
          <span>View squad status</span>
          <span className={ui.summaryRight}>
            <FiUsers size={15} /> {squadSummaryText}
          </span>
        </summary>

        <div className={ui.detailsBody}>
          {namesLoadFailed ? (
            <div className={styles.loadStateRow}>
              <span>Couldn’t load the ins and outs just yet.</span>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnSoft} ${styles.loadRetryBtn}`}
                onClick={retrySquadLoad}
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className={styles.availabilityNamesGrid}>
            <div>
              <div className={styles.nameColTitle}>✅ In</div>
              <div className={styles.nameColBody}>
                {isNamesLoading ? (
                  <>
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineMid}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineMid}`} />
                  </>
                ) : names.yes.length ? (
                  names.yes.map((n, i) => <div key={i}>{truncateName(n)}</div>)
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <div className={styles.nameColTitle}>🤷 Maybe</div>
              <div className={styles.nameColBody}>
                {isNamesLoading ? (
                  <>
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineMid}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                  </>
                ) : names.maybe.length ? (
                  names.maybe.map((n, i) => <div key={i}>{truncateName(n)}</div>)
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <div className={styles.nameColTitle}>💩 Out</div>
              <div className={styles.nameColBody}>
                {isNamesLoading ? (
                  <>
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineMid}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
                  </>
                ) : names.no.length ? (
                  names.no.map((n, i) => <div key={i}>{truncateName(n)}</div>)
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
