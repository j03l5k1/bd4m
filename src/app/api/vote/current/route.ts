import { NextResponse } from "next/server";
import {
  type VoteState,
  type VoteStateResponse,
} from "@/lib/briars/vote";
import {
  ensureVoteGameId,
  findActiveVoteGame,
  findPlayerByName,
  getEligibleVotePlayers,
  getExistingVote,
  getVoteResults,
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
    const game = await findActiveVoteGame(new Date(nowISO));
    if (!game) {
      return voteResponse({
        status: "no_active_vote",
        nowISO,
        game: null,
        message: "No active Man of the Match vote right now.",
      });
    }

    if (playerName.length < 2 || invalidPin(pin)) {
      return voteResponse({
        status: "login_required",
        nowISO,
        game,
        message: "Enter your saved player name and team PIN to vote.",
      });
    }

    const gameId = await ensureVoteGameId(game);
    const eligiblePlayers = await getEligibleVotePlayers(game);
    const voter = await findPlayerByName(playerName);
    const eligibleVoter = isEligibleVoter(playerName, eligiblePlayers);

    if (!voter || !eligibleVoter) {
      return voteResponse({
        status: "not_eligible",
        nowISO,
        game,
        playerName,
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
        message: "Vote locked in. Live standings are below.",
      });
    }

    const nominees = eligiblePlayers.filter(
      (player) => player.playerId !== eligibleVoter.playerId
    );

    return voteResponse({
      status: nominees.length ? "eligible_to_vote" : "not_eligible",
      nowISO,
      game,
      playerName: voter.name,
      nominees,
      message: nominees.length
        ? "Pick the teammate who deserves the car-park votes."
        : "Not enough eligible teammates to open voting.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Could not load vote state" },
      { status: 500 }
    );
  }
}
