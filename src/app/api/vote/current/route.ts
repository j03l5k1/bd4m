import { NextResponse } from "next/server";
import {
  type VoteState,
  type VoteStateResponse,
} from "@/lib/briars/vote";
import {
  ensureVoteGameId,
  findVotePageGame,
  findPlayerByName,
  getSeasonVoteStats,
  getEligibleVotePlayers,
  getExistingVote,
  getVoteResults,
  getVoteWindowState,
  isEligibleVoter,
} from "@/lib/server/vote";

function voteResponse(vote: VoteState) {
  return NextResponse.json({ ok: true, vote } satisfies VoteStateResponse);
}

function invalidPin(pin: string) {
  const teamPin = process.env.TEAM_PIN || "briars2026";
  return !pin || pin !== teamPin;
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const playerName = String(body?.playerName || "").trim();
  const pin = String(body?.pin || "").trim();
  const nowISO = new Date().toISOString();

  try {
    const now = new Date(nowISO);
    const [game, seasonStats] = await Promise.all([
      findVotePageGame(now),
      getSeasonVoteStats(),
    ]);

    if (!game) {
      return voteResponse({
        status: "no_active_vote",
        nowISO,
        game: null,
        seasonStats,
        message: "No active Man of the Match vote right now.",
      });
    }

    const nominees = await getEligibleVotePlayers(game);
    const canIdentifyViewer = playerName.length >= 2 && !invalidPin(pin);
    const viewer = canIdentifyViewer ? await findPlayerByName(playerName) : null;
    const eligibleViewer = canIdentifyViewer ? isEligibleVoter(playerName, nominees) : null;
    const displayNominees =
      viewer && eligibleViewer
        ? nominees.filter((player) => player.playerId !== eligibleViewer.playerId)
        : nominees;
    const windowState = getVoteWindowState(game, now);

    if (windowState === "locked") {
      return voteResponse({
        status: "vote_locked",
        nowISO,
        game,
        nominees: displayNominees,
        seasonStats,
        message: "Voting unlocks 5 minutes after the game ends and closes 60 minutes after the match.",
      });
    }

    if (playerName.length < 2 || invalidPin(pin)) {
      return voteResponse({
        status: "login_required",
        nowISO,
        game,
        nominees: displayNominees,
        seasonStats,
        message: "Enter your saved player name and team PIN to vote.",
      });
    }

    const gameId = await ensureVoteGameId(game);
    const voter = viewer;
    const eligibleVoter = eligibleViewer;

    if (!voter || !eligibleVoter) {
      return voteResponse({
        status: "not_eligible",
        nowISO,
        game,
        playerName,
        nominees: displayNominees,
        seasonStats,
        message: "Only players marked in for this match can vote.",
      });
    }

    const myVotePlayerId = await getExistingVote(gameId, voter.id);
    if (myVotePlayerId) {
      const results = await getVoteResults(gameId);
      return voteResponse({
        status: "already_voted",
        nowISO,
        game,
        playerName: voter.name,
        myVotePlayerId,
        results,
        seasonStats,
        message: "Vote locked in. Live standings are below.",
      });
    }

    const selectableNominees = displayNominees;

    return voteResponse({
      status: selectableNominees.length ? "eligible_to_vote" : "not_eligible",
      nowISO,
      game,
      playerName: voter.name,
      nominees: selectableNominees,
      seasonStats,
      message: selectableNominees.length
        ? "Pick the teammate who deserves tonight’s votes."
        : "Not enough eligible teammates to open voting.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Could not load vote state" },
      { status: 500 }
    );
  }
}
