import { NextResponse } from "next/server";
import { type VoteStateResponse } from "@/lib/briars/vote";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
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

function invalidPin(pin: string) {
  const teamPin = process.env.TEAM_PIN || "briars2026";
  return !pin || pin !== teamPin;
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const playerName = String(body?.playerName || "").trim();
  const pin = String(body?.pin || "").trim();
  const nomineePlayerId = String(body?.nomineePlayerId || "").trim();
  const nowISO = new Date().toISOString();

  if (playerName.length < 2) {
    return NextResponse.json({ ok: false, error: "Player name required" }, { status: 400 });
  }
  if (invalidPin(pin)) {
    return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
  }
  if (!nomineePlayerId) {
    return NextResponse.json({ ok: false, error: "Pick a nominee first" }, { status: 400 });
  }

  try {
    const now = new Date(nowISO);
    const [game, seasonStats] = await Promise.all([
      findVotePageGame(now),
      getSeasonVoteStats(),
    ]);

    if (!game) {
      return NextResponse.json({ ok: false, error: "No active vote right now" }, { status: 400 });
    }
    if (getVoteWindowState(game, now) !== "open") {
      return NextResponse.json(
        { ok: false, error: "Voting is still locked for this match" },
        { status: 400 }
      );
    }

    const gameId = await ensureVoteGameId(game);
    const eligiblePlayers = await getEligibleVotePlayers(game);
    const voter = await findPlayerByName(playerName);
    const eligibleVoter = isEligibleVoter(playerName, eligiblePlayers);

    if (!voter || !eligibleVoter) {
      return NextResponse.json(
        { ok: false, error: "Only players marked in for this match can vote" },
        { status: 403 }
      );
    }

    if (eligibleVoter.playerId === nomineePlayerId) {
      return NextResponse.json({ ok: false, error: "No self-voting" }, { status: 400 });
    }

    const nominee = eligiblePlayers.find((player) => player.playerId === nomineePlayerId);
    if (!nominee) {
      return NextResponse.json({ ok: false, error: "That nominee is not eligible" }, { status: 400 });
    }

    const existingVote = await getExistingVote(gameId, voter.id);
    if (existingVote) {
      const results = await getVoteResults(gameId);
      return NextResponse.json({
        ok: true,
        vote: {
          status: "already_voted",
          nowISO,
          game,
          playerName: voter.name,
          myVotePlayerId: existingVote,
          results,
          seasonStats,
          message: "Vote already recorded.",
        },
      } satisfies VoteStateResponse);
    }

    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("motm_votes")
      .insert({
        game_id: gameId,
        voter_player_id: voter.id,
        nominee_player_id: nomineePlayerId,
      });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const results = await getVoteResults(gameId);
    return NextResponse.json({
      ok: true,
      vote: {
        status: "already_voted",
        nowISO,
        game,
        playerName: voter.name,
        myVotePlayerId: nomineePlayerId,
        results,
        seasonStats,
        message: "Vote locked in. Live standings are below.",
      },
    } satisfies VoteStateResponse);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Could not save vote" },
      { status: 500 }
    );
  }
}
