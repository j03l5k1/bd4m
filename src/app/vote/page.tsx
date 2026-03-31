"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiAward,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";
import { LS_PIN_OK, LS_PLAYER_NAME, LS_TEAM_PIN } from "@/lib/briars/constants";
import type {
  VoteResultsEntry,
  VoteState,
  VoteStateResponse,
} from "@/lib/briars/vote";
import styles from "./vote.module.css";

function capitaliseNameInput(raw: string): string {
  return raw
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function formatLongDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatClock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  return d.toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function timeUntilLabel(iso: string, nowMs: number) {
  const diff = new Date(iso).getTime() - nowMs;
  if (!Number.isFinite(diff)) return "Timing unavailable";
  if (diff <= 0) return "Closing soon";

  const mins = Math.max(Math.round(diff / 60_000), 1);
  if (mins < 60) return `${mins}m left to vote`;

  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m left to vote` : `${hours}h left to vote`;
}

function resultsLabel(entry: VoteResultsEntry, totalVotes: number) {
  if (!totalVotes) return "No votes yet";
  return `${entry.votes} vote${entry.votes === 1 ? "" : "s"} • ${entry.percentage}%`;
}

async function postJSON<T>(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json as T;
}

export default function VotePage() {
  const [savedPlayerName, setSavedPlayerName] = useState("");
  const [savedPin, setSavedPin] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [voteState, setVoteState] = useState<VoteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNomineeId, setSelectedNomineeId] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const storedName = localStorage.getItem(LS_PLAYER_NAME) || "";
    const storedPin = localStorage.getItem(LS_TEAM_PIN) || "";
    setSavedPlayerName(storedName);
    setSavedPin(storedPin);
    setNameInput(storedName);
    setPinInput(storedPin);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  async function refreshVoteState(playerName = savedPlayerName, pin = savedPin) {
    setLoading(true);
    setError(null);
    try {
      const json = await postJSON<VoteStateResponse>("/api/vote/current", {
        playerName,
        pin,
      });
      setVoteState(json.vote);
      setSelectedNomineeId("");
    } catch (e: any) {
      setError(e?.message || "Could not load the vote page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    void refreshVoteState(savedPlayerName, savedPin);
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveLogin() {
    const cleanName = nameInput.trim();
    const cleanPin = pinInput.trim();

    if (cleanName.length < 2) {
      setError("Enter your name first.");
      return;
    }
    if (!cleanPin) {
      setError("Enter the team PIN.");
      return;
    }

    localStorage.setItem(LS_PLAYER_NAME, cleanName);
    localStorage.setItem(LS_TEAM_PIN, cleanPin);
    localStorage.setItem(LS_PIN_OK, "1");

    setSavedPlayerName(cleanName);
    setSavedPin(cleanPin);
    await refreshVoteState(cleanName, cleanPin);
  }

  function switchPlayer() {
    localStorage.removeItem(LS_PLAYER_NAME);
    localStorage.removeItem(LS_TEAM_PIN);
    localStorage.removeItem(LS_PIN_OK);
    setSavedPlayerName("");
    setSavedPin("");
    setNameInput("");
    setPinInput("");
    setSelectedNomineeId("");
    void refreshVoteState("", "");
  }

  async function castVote() {
    if (!selectedNomineeId) {
      setError("Pick your Man of the Match first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const json = await postJSON<VoteStateResponse>("/api/vote/cast", {
        playerName: savedPlayerName,
        pin: savedPin,
        nomineePlayerId: selectedNomineeId,
      });
      setVoteState(json.vote);
    } catch (e: any) {
      setError(e?.message || "Could not save your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  const voteGame = voteState?.game;
  const pageTag =
    voteState?.status === "eligible_to_vote"
      ? "Vote open now"
      : voteState?.status === "already_voted"
        ? "Vote received"
        : "Car park MOTM";

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <Link href="/briars" className={styles.backLink}>
            <FiArrowLeft size={16} />
            Back to fixtures
          </Link>
          <span className={styles.heroTag}>{pageTag}</span>
        </div>

        <div className={styles.heroBody}>
          <div>
            <div className={styles.kicker}>Briars Snr Masters</div>
            <h1 className={styles.title}>Man of the Match</h1>
            <p className={styles.subtitle}>
              Quick car-park voting for the current match. Vote once, then the standings unlock.
            </p>
          </div>

          {voteGame ? (
            <div className={styles.matchCard}>
              <div className={styles.matchTeams}>
                <span>{voteGame.home}</span>
                <span className={styles.matchVs}>vs</span>
                <span>{voteGame.away}</span>
              </div>
              <div className={styles.matchMeta}>
                <span>
                  <FiClock size={14} /> {formatLongDate(voteGame.kickoffISO)} • {formatClock(voteGame.kickoffISO)}
                </span>
                <span>
                  <FiMapPin size={14} /> {voteGame.venue || "Venue TBC"}
                </span>
                <span>
                  <FiUsers size={14} /> {timeUntilLabel(voteGame.voteClosesAtISO, nowMs)}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.matchCardMuted}>
              Voting opens 65 minutes after kickoff and wraps up shortly after the post-match car park chat.
            </div>
          )}
        </div>
      </section>

      {error ? (
        <section className={styles.noticeError}>
          <span>{error}</span>
          <button type="button" className={styles.noticeBtn} onClick={() => refreshVoteState()}>
            <FiRefreshCw size={14} />
            Retry
          </button>
        </section>
      ) : null}

      {loading ? (
        <section className={styles.panel}>
          <div className={styles.loadingTitle}>Loading vote room…</div>
          <div className={styles.loadingRows}>
            <span className={`${styles.skeleton} ${styles.skeletonWide}`} />
            <span className={`${styles.skeleton} ${styles.skeletonMid}`} />
            <span className={`${styles.skeleton} ${styles.skeletonShort}`} />
          </div>
        </section>
      ) : null}

      {!loading && voteState?.status === "no_active_vote" ? (
        <section className={styles.panel}>
          <div className={styles.emptyTitle}>No active vote right now</div>
          <p className={styles.emptyBody}>
            The vote page will wake up automatically after a Briars match enters the car-park window.
          </p>
          <div className={styles.panelActions}>
            <Link href="/briars" className={styles.primaryLink}>
              Head back to fixtures
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && voteState?.status === "login_required" ? (
        <section className={styles.grid}>
          <section className={styles.panel}>
            <div className={styles.panelKicker}>Step 1</div>
            <h2 className={styles.panelTitle}>Confirm your player details</h2>
            <p className={styles.panelText}>
              Use the same saved name and team PIN you use for availability so we know whose vote this is.
            </p>

            <label className={styles.fieldLabel}>Player name</label>
            <input
              className={styles.input}
              value={nameInput}
              onChange={(e) => setNameInput(capitaliseNameInput(e.target.value))}
              placeholder="Your name"
              autoComplete="name"
            />

            <label className={styles.fieldLabel}>Team PIN</label>
            <input
              className={styles.input}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter team PIN"
            />

            <div className={styles.panelActions}>
              <button type="button" className={styles.primaryBtn} onClick={saveLogin}>
                Continue to vote
              </button>
            </div>
          </section>

          <section className={styles.panelAlt}>
            <div className={styles.panelKicker}>Tonight’s flow</div>
            <h2 className={styles.panelTitle}>One vote, then standings</h2>
            <p className={styles.panelText}>
              Once you vote, this page flips to the live tally so you can see how the car park is leaning.
            </p>
          </section>
        </section>
      ) : null}

      {!loading && voteState?.status === "not_eligible" ? (
        <section className={styles.panel}>
          <div className={styles.emptyTitle}>This device isn’t eligible for tonight’s vote</div>
          <p className={styles.emptyBody}>
            {voteState.message || "Only players marked in for the match can vote."}
          </p>
          <div className={styles.panelActions}>
            <button type="button" className={styles.secondaryBtn} onClick={switchPlayer}>
              Switch player
            </button>
            <Link href="/briars" className={styles.primaryLink}>
              Back to fixtures
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && voteState?.status === "eligible_to_vote" ? (
        <section className={styles.gridVote}>
          <section className={styles.votePanel}>
            <div className={styles.panelKicker}>Step 2</div>
            <h2 className={styles.voteTitle}>Pick your Man of the Match</h2>
            <p className={styles.voteText}>
              {voteState.message || "Choose the teammate who deserves the 3 points tonight."}
            </p>

            <div className={styles.nomineeGrid}>
              {(voteState.nominees || []).map((nominee) => (
                <button
                  key={nominee.playerId}
                  type="button"
                  className={`${styles.nomineeCard} ${
                    selectedNomineeId === nominee.playerId ? styles.nomineeCardActive : ""
                  }`}
                  onClick={() => setSelectedNomineeId(nominee.playerId)}
                >
                  <span className={styles.nomineeBadge}>Vote</span>
                  <span className={styles.nomineeName}>{nominee.name}</span>
                </button>
              ))}
            </div>

            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={submitting || !selectedNomineeId}
                onClick={castVote}
              >
                {submitting ? "Submitting…" : "Lock in vote"}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={switchPlayer}>
                Switch player
              </button>
            </div>
          </section>

          <section className={styles.sidePanel}>
            <div className={styles.sideCallout}>
              <FiAward size={18} />
              <span>Results stay hidden until your vote is in.</span>
            </div>
            <p className={styles.sideText}>
              Vote once and the live ladder for tonight’s MOTM opens immediately on this page.
            </p>
          </section>
        </section>
      ) : null}

      {!loading && voteState?.status === "already_voted" ? (
        <section className={styles.gridVote}>
          <section className={styles.resultsPanel}>
            <div className={styles.thanksRow}>
              <span className={styles.thanksIcon}>
                <FiCheckCircle size={18} />
              </span>
              <div>
                <div className={styles.panelKicker}>Vote received</div>
                <h2 className={styles.voteTitle}>Nice one, {voteState.playerName}</h2>
              </div>
            </div>

            <p className={styles.voteText}>
              {voteState.message || "Your vote is locked in. Here’s how the car park is shaping up."}
            </p>

            <div className={styles.resultsList}>
              {(voteState.results?.entries || []).map((entry) => (
                <div
                  key={entry.playerId}
                  className={`${styles.resultRow} ${
                    voteState.myVotePlayerId === entry.playerId ? styles.resultRowActive : ""
                  }`}
                >
                  <div className={styles.resultTop}>
                    <span className={styles.resultName}>{entry.name}</span>
                    <span className={styles.resultMeta}>
                      {resultsLabel(entry, voteState.results?.totalVotes || 0)}
                    </span>
                  </div>
                  <div className={styles.resultBarRail}>
                    <div
                      className={styles.resultBarFill}
                      style={{ width: `${Math.max(entry.percentage, entry.votes ? 10 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}

              {!voteState.results?.entries?.length ? (
                <div className={styles.emptyTiny}>No votes have landed yet. You’re first on the board.</div>
              ) : null}
            </div>

            <div className={styles.panelActions}>
              <Link href="/briars" className={styles.primaryLink}>
                Back to fixtures
              </Link>
              <button type="button" className={styles.secondaryBtn} onClick={() => refreshVoteState()}>
                Refresh standings
              </button>
            </div>
          </section>

          <section className={styles.sidePanel}>
            <div className={styles.sideCallout}>
              <FiUsers size={18} />
              <span>
                {voteState.results?.totalVotes || 0} vote
                {(voteState.results?.totalVotes || 0) === 1 ? "" : "s"} counted
              </span>
            </div>
            <p className={styles.sideText}>
              This stays live while the post-match voting window is open, then the page settles down again.
            </p>
          </section>
        </section>
      ) : null}
    </main>
  );
}
