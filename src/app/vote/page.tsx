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
import { GiLaurels } from "react-icons/gi";
import { LS_PIN_OK, LS_PLAYER_NAME, LS_TEAM_PIN } from "@/lib/briars/constants";
import {
  MOTM_CLOSE_AFTER_GAME_END_MINUTES,
  MOTM_OPEN_AFTER_GAME_END_MINUTES,
  type VoteGameSummary,
} from "@/lib/briars/vote";
import { getTeamMeta } from "@/lib/briars/teamMeta";
import type {
  VoteResultsEntry,
  VoteSeasonStatsEntry,
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

function formatDuration(targetISO: string, nowMs: number) {
  const diff = new Date(targetISO).getTime() - nowMs;
  if (!Number.isFinite(diff)) return "timing unavailable";
  if (diff <= 0) return "less than a minute";

  const mins = Math.max(Math.round(diff / 60_000), 1);
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function voteWindowLabel(
  status: VoteState["status"] | undefined,
  game: VoteGameSummary,
  nowMs: number
) {
  if (status === "vote_locked") {
    return `Voting unlocks in ${formatDuration(game.voteOpensAtISO, nowMs)}`;
  }
  return `Voting closes in ${formatDuration(game.voteClosesAtISO, nowMs)}`;
}

function resultsLabel(entry: VoteResultsEntry, totalVotes: number) {
  if (!totalVotes) return "No votes yet";
  return `${entry.votes} vote${entry.votes === 1 ? "" : "s"} • ${entry.percentage}%`;
}

function voteWindowCopy() {
  return `Voting opens ${MOTM_OPEN_AFTER_GAME_END_MINUTES} minutes after end of game and closes ${MOTM_CLOSE_AFTER_GAME_END_MINUTES} minutes after match.`;
}

function initialsForName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "P";
}

type NomineeCardProps = {
  name: string;
  locked?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

function NomineeCard({ name, locked = false, selected = false, onClick }: NomineeCardProps) {
  return (
    <button
      type="button"
      className={[
        styles.nomineeCard,
        locked ? styles.nomineeCardLocked : "",
        selected ? styles.nomineeCardActive : "",
      ].join(" ")}
      disabled={locked}
      onClick={onClick}
    >
      <div className={styles.nomineeTop}>
        <span className={styles.nomineeAvatar}>{initialsForName(name)}</span>
        <div className={styles.nomineeBody}>
          <span className={styles.nomineeName}>{name}</span>
          <span className={styles.nomineeSubcopy}>
            {locked
              ? "Available when voting opens"
              : selected
                ? "Selected and ready to submit"
                : "Tap to choose this player"}
          </span>
        </div>
        <span
          className={[
            styles.nomineeState,
            locked ? styles.nomineeStateLocked : "",
            selected ? styles.nomineeStateSelected : "",
          ].join(" ")}
        >
          {locked ? "Locked" : selected ? "Selected" : "Vote"}
        </span>
      </div>
    </button>
  );
}

function VoteTeamLogo({ name }: { name: string }) {
  const meta = getTeamMeta(name);
  const fallback = meta.shortName.slice(0, 1).toUpperCase();
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [name, meta.logoUrl]);

  const showImage = Boolean(meta.logoUrl) && !logoFailed;

  return (
    <div className={styles.teamLogoWrap}>
      {showImage ? (
        <img
          src={meta.logoUrl}
          alt={meta.shortName}
          className={styles.teamLogo}
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className={styles.teamLogoFallback}>{fallback}</span>
      )}
    </div>
  );
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
      await postJSON<VoteStateResponse>("/api/vote/cast", {
        playerName: savedPlayerName,
        pin: savedPin,
        nomineePlayerId: selectedNomineeId,
      });
      await refreshVoteState(savedPlayerName, savedPin);
    } catch (e: any) {
      setError(e?.message || "Could not save your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  const voteGame = voteState?.game;
  const pageTag =
    voteState?.status === "vote_locked"
      ? "Preview"
      : voteState?.status === "eligible_to_vote"
      ? "Vote open now"
      : voteState?.status === "already_voted"
        ? "Live results"
        : "MOTM Hub";
  const timerLabel =
    voteGame && voteState?.status !== "no_active_vote"
      ? voteWindowLabel(voteState?.status, voteGame, nowMs)
      : null;
  const countdownValue = voteGame
    ? formatDuration(
        voteState?.status === "vote_locked" ? voteGame.voteOpensAtISO : voteGame.voteClosesAtISO,
        nowMs
      )
    : null;
  const homeMeta = voteGame ? getTeamMeta(voteGame.home) : null;
  const awayMeta = voteGame ? getTeamMeta(voteGame.away) : null;
  const isVoteLocked = voteState?.status === "vote_locked";
  const isVoteLive = voteState?.status === "eligible_to_vote";
  const isResultsLive = voteState?.status === "already_voted";
  const heroStatusHeading = isVoteLocked ? "Voting unlocks in" : "Voting closes in";
  const heroStatusNote = isVoteLocked
    ? "Nominees are set now. Voting opens 5 minutes after full time."
    : "One vote per player. Live standings open as soon as your vote is in.";
  const voteStageLabel =
    isVoteLocked ? (voteGame?.roundLabel || "Match") : isVoteLive ? "Vote live" : isResultsLive ? "Standings" : "MOTM";
  const selectedNomineeName =
    voteState?.nominees?.find((nominee) => nominee.playerId === selectedNomineeId)?.name || "";
  const standingsEntries = voteState?.seasonStats?.entries || [];
  const standingsHaveVotes = standingsEntries.length > 0;
  const statsRows: Array<
    VoteSeasonStatsEntry & { placeholder?: boolean }
  > = standingsHaveVotes
    ? standingsEntries
    : [
        {
          playerId: "placeholder-1",
          name: "Awaiting first vote",
          manOfTheMatchCount: 0,
          points: 0,
          totalVotes: 0,
          placeholder: true,
        },
        {
          playerId: "placeholder-2",
          name: "Season ladder opens tonight",
          manOfTheMatchCount: 0,
          points: 0,
          totalVotes: 0,
          placeholder: true,
        },
        {
          playerId: "placeholder-3",
          name: "Top 3 settles after voting",
          manOfTheMatchCount: 0,
          points: 0,
          totalVotes: 0,
          placeholder: true,
        },
      ];

  return (
    <main
      className={`${styles.shell} ${
        voteState?.status === "eligible_to_vote" ? styles.shellWithSticky : ""
      }`}
    >
      {/* Header — mirrors briars HeaderBar */}
      <header className={styles.header}>
        <div>
          <Link href="/briars" className={styles.backLink}>
            <FiArrowLeft size={14} />
            Back to fixtures
          </Link>
          <h1 className={styles.h1}>
            <GiLaurels className={styles.h1Wreath} aria-hidden />
            <span className={styles.h1Main}>Man of the</span>
            <span className={styles.h1Subhead}>Match</span>
            <GiLaurels className={`${styles.h1Wreath} ${styles.h1WreathRight}`} aria-hidden />
          </h1>
          <p className={styles.sub}>
            Cast your MOTM vote and follow live standings as post-match results take shape.
          </p>
        </div>

        <div className={styles.headerActions}>
          <span
            className={[
              styles.pill,
              isVoteLive ? styles.pillGreen : isVoteLocked ? styles.pillGold : "",
            ].join(" ")}
          >
            <FiAward size={12} />
            {pageTag}
          </span>
        </div>
      </header>

      {/* Match card */}
      {voteGame ? (
        <div className={styles.matchCard}>
          <div className={styles.matchCardPad}>
            <div className={styles.matchEyebrow}>
              {voteGame.roundLabel || "Match vote"} · Briars Snr Masters
            </div>
            <div className={styles.matchShowcase}>
              <div className={styles.teamSide}>
                <VoteTeamLogo name={voteGame.home} />
                <span className={styles.teamName}>{homeMeta?.shortName || voteGame.home}</span>
              </div>

              <div className={styles.vsColumn}>
                <span className={styles.vsWord}>vs</span>
                <span className={styles.vsPill}>{voteStageLabel}</span>
              </div>

              <div className={styles.teamSide}>
                <VoteTeamLogo name={voteGame.away} />
                <span className={styles.teamName}>{awayMeta?.shortName || voteGame.away}</span>
              </div>
            </div>

            <div className={styles.matchMeta}>
              <span className={styles.matchMetaLine}>
                <FiClock size={12} />
                {formatLongDate(voteGame.kickoffISO)} · {formatClock(voteGame.kickoffISO)}
              </span>
              <span className={styles.matchMetaLine}>
                <FiMapPin size={12} />
                {voteGame.venue || "Venue TBC"}
              </span>
            </div>
          </div>

          {voteState?.status !== "no_active_vote" && timerLabel ? (
            <div
              className={[
                styles.countdownBar,
                !isVoteLocked ? styles.countdownBarLive : "",
              ].join(" ")}
            >
              <span className={styles.countdownBarText}>
                {heroStatusHeading}{" "}
                <strong className={styles.countdownBarTime}>
                  {countdownValue || "soon"}
                </strong>
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.matchCardMuted}>
          {voteWindowCopy()}
        </div>
      )}

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
            The vote page will wake up automatically once a Briars match reaches the MOTM vote window.
          </p>
          <div className={styles.panelActions}>
            <Link href="/briars" className={styles.primaryLink}>
              Head back to fixtures
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && voteState?.status === "vote_locked" ? (
        <section className={styles.gridVote}>
          <section className={styles.votePanel}>
            <div className={styles.panelKicker}>Match voting</div>
            <h2 className={styles.voteTitle}>Eligible nominees</h2>
            <p className={styles.voteText}>
              Tonight’s nominees are set. Voting opens 5 minutes after full time, so you can see the field early and vote fast when the window opens.
            </p>

            <div className={styles.sectionReminder}>
              <span className={styles.sectionReminderLabel}>Next unlock</span>
              <strong className={styles.sectionReminderValue}>
                {timerLabel || "Voting timer loading"}
              </strong>
            </div>

            <div className={styles.nomineeGrid}>
              {(voteState.nominees || []).length ? (
                (voteState.nominees || []).map((nominee) => (
                  <NomineeCard key={nominee.playerId} name={nominee.name} locked />
                ))
              ) : (
                <div className={styles.emptyTiny}>
                  No eligible names are loaded yet. As players mark themselves in, they’ll appear here.
                </div>
              )}
            </div>

            <div className={styles.panelActions}>
              <button type="button" className={styles.primaryBtn} disabled>
                Voting locked
              </button>
            </div>
          </section>

          <section className={styles.sidePanel}>
            <div className={styles.panelKicker}>How voting works</div>
            <h3 className={styles.sideTitle}>One vote, then live standings</h3>
            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>1</span>
                <p className={styles.sideText}>Use the same saved player name and PIN as availability.</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>2</span>
                <p className={styles.sideText}>Cast one vote once the window opens. Results stay hidden until you do.</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>3</span>
                <p className={styles.sideText}>Season standings award 3-2-1 based on the final finishing order for each match.</p>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {!loading && voteState?.status === "login_required" ? (
        <section className={styles.grid}>
          <section className={styles.votePanel}>
            <div className={styles.panelKicker}>Match voting</div>
            <h2 className={styles.panelTitle}>Ready your vote</h2>
            <p className={styles.panelText}>
              Save your player details now so you can get straight into the vote when the window opens.
            </p>

            {timerLabel ? (
              <div className={styles.sectionReminder}>
                <span className={styles.sectionReminderLabel}>
                  {isVoteLocked ? "Unlock timer" : "Vote room live"}
                </span>
                <strong className={styles.sectionReminderValue}>{timerLabel}</strong>
              </div>
            ) : null}

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
                Save player details
              </button>
            </div>
          </section>

          <section className={styles.sidePanel}>
            <div className={styles.panelKicker}>Tonight’s flow</div>
            <h3 className={styles.sideTitle}>Simple and quick on mobile</h3>
            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>1</span>
                <p className={styles.sideText}>Preview nominees before the vote unlocks.</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>2</span>
                <p className={styles.sideText}>Cast one MOTM vote for the player who stood out most.</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>3</span>
                <p className={styles.sideText}>Watch the live tally, while season standings award 3-2-1 from the final order.</p>
              </div>
            </div>
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
            <div className={styles.panelKicker}>Match voting</div>
            <h2 className={styles.voteTitle}>Eligible nominees</h2>
            <p className={styles.voteText}>
              Choose the player who stood out most tonight. You cast one vote per match, then the live standings unlock immediately.
            </p>

            <div className={styles.sectionReminder}>
              <span className={styles.sectionReminderLabel}>Vote window</span>
              <strong className={styles.sectionReminderValue}>
                {timerLabel || "Voting closes soon"}
              </strong>
            </div>

            <div className={styles.nomineeGrid}>
              {(voteState.nominees || []).map((nominee) => (
                <NomineeCard
                  key={nominee.playerId}
                  name={nominee.name}
                  selected={selectedNomineeId === nominee.playerId}
                  onClick={() => setSelectedNomineeId(nominee.playerId)}
                />
              ))}
            </div>

            <div className={`${styles.panelActions} ${styles.desktopSubmitRow}`}>
              <button
                type="button"
                className={`${styles.primaryBtn} ${styles.desktopSubmitBtn}`}
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
            <h3 className={styles.sideTitle}>How tonight works</h3>
            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>1</span>
                <p className={styles.sideText}>Pick one nominee only. There’s no ranking step on the page.</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>2</span>
                <p className={styles.sideText}>The live vote table appears as soon as your vote is locked in.</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>3</span>
                <p className={styles.sideText}>Season standings still award 3-2-1 based on the final vote result from each match.</p>
              </div>
            </div>
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

            <div className={styles.sectionReminder}>
              <span className={styles.sectionReminderLabel}>Live room</span>
              <strong className={styles.sectionReminderValue}>
                {timerLabel || "Standings are live"}
              </strong>
            </div>

            <p className={styles.voteText}>
              {voteState.message || "Your vote is locked in. Here’s how tonight’s standings are shaping up."}
            </p>

            <div className={styles.resultsList}>
              {(voteState.results?.entries || []).map((entry, index) => (
                <div
                  key={entry.playerId}
                  className={`${styles.resultRow} ${
                    voteState.myVotePlayerId === entry.playerId ? styles.resultRowActive : ""
                  }`}
                >
                  <div className={styles.resultTop}>
                    <span className={styles.resultRank}>{index + 1}</span>
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
            <h3 className={styles.sideTitle}>What happens next</h3>
            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>1</span>
                <p className={styles.sideText}>This live table stays open while the vote window is active.</p>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoItemNum}>2</span>
                <p className={styles.sideText}>Season standings award 3-2-1 points from the final finishing order, not from ranked ballots.</p>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {!loading ? (
        <section className={styles.statsPanel}>
          <div className={styles.statsHeader}>
            <div>
              <div className={styles.panelKicker}>Season table</div>
              <h2 className={styles.panelTitle}>MOTM standings</h2>
            </div>
            <p className={styles.statsText}>
              {voteState?.seasonStats?.gamesWithVotes || 0} match
              {(voteState?.seasonStats?.gamesWithVotes || 0) === 1 ? "" : "es"} with votes recorded.
              Points are awarded 3-2-1 by finish in each vote.
            </p>
          </div>

          {!standingsHaveVotes ? (
            <div className={styles.statsEmptyState}>
              No votes recorded yet. Standings will update after tonight’s match once the first results land.
            </div>
          ) : null}

          <div className={styles.statsTableWrap}>
            <table className={styles.statsTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>MOTM</th>
                  <th>Pts</th>
                  <th>Votes</th>
                </tr>
              </thead>
              <tbody>
                {statsRows.map((entry, index) => (
                  <tr
                    key={entry.playerId}
                    className={`${styles.statsRow} ${
                      index === 0
                        ? styles.statsRowTop
                        : index === 1
                          ? styles.statsRowSecond
                          : index === 2
                            ? styles.statsRowThird
                            : ""
                    } ${entry.placeholder ? styles.statsRowPlaceholder : ""}`}
                  >
                    <td className={styles.statsRank}>{index + 1}</td>
                    <td>
                      <div className={styles.statsPlayerCell}>
                        <span className={styles.statsPlayerName}>{entry.name}</span>
                        {entry.placeholder ? (
                          <span className={styles.statsPlaceholderTag}>Awaiting votes</span>
                        ) : null}
                      </div>
                    </td>
                    <td className={styles.statsNumBadge}>
                      <span className={styles.motmBadge}>{entry.manOfTheMatchCount}</span>
                    </td>
                    <td className={styles.statsNum}>{entry.points}</td>
                    <td className={styles.statsNum}>{entry.totalVotes}</td>
                  </tr>
                ))}

                {!statsRows.length ? (
                  <tr>
                    <td colSpan={5} className={styles.statsEmpty}>
                      No season voting stats yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && voteState?.status === "eligible_to_vote" ? (
        <div className={styles.stickyVoteBar}>
          <div className={styles.stickyVoteMeta}>
            <span className={styles.stickyVoteLabel}>Tonight’s vote</span>
            <strong className={styles.stickyVoteName}>
              {selectedNomineeName || "Choose a nominee"}
            </strong>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={submitting || !selectedNomineeId}
            onClick={castVote}
          >
            {submitting ? "Submitting…" : "Lock in vote"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
