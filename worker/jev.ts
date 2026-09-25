// Jev decision layer: turns our small game state into a Decisions API request,
// and turns Jev's answers back into a small domain object.
//
// Nothing outside this file needs to understand OpenRouter's request or
// response shapes. Copy this file (plus openrouter.ts) into another project,
// then change the state, actions and question.
//
// Jev is a decision model, not a chat model: it does not generate text. You
// give it `state` plus typed `questions`, and it returns a probability
// distribution per question. Endpoint: POST /api/alpha/decisions (alpha!).

import type { OpenRouter } from "@openrouter/sdk";
import type { DecisionRequest, DecisionResponse, JevAction } from "../shared/types.ts";
import { JEV_ACTIONS } from "../shared/types.ts";
import { FREEZE_RADIUS, FREEZE_RECHARGE_SECONDS, FREEZE_SECONDS, HEALTH_PACK_HEAL } from "../shared/rules.ts";

// Pinned deliberately. `~typesafe/jev-latest` is a moving alias that tracks the
// newest Jev; opt into it only if you accept behaviour changing underneath you.
export const JEV_MODEL = "typesafe/jev-1.13";

// One sentence per action. Jev chooses between these descriptions, so their
// wording matters as much as the state does. Keep them concrete and distinct.
const ACTION_CRITERIA: Record<JevAction, string> = {
  APPROACH_ENEMY: "Move toward the nearest enemy to fight it.",
  EVADE: "Move away from the nearest enemy to avoid being hurt.",
  SEEK_EXIT: "Move toward the exit to leave the area.",
  SEEK_HEALTH: `Move toward the nearest health pack to pick it up and recover ${HEALTH_PACK_HEAL} health.`,
  FREEZE: `Use the freeze power now: every enemy within ${FREEZE_RADIUS} units is frozen for ${FREEZE_SECONDS} seconds and cannot move or attack. It then takes ${FREEZE_RECHARGE_SECONDS} seconds to recharge.`,
  WAIT: "Stay where you are and do nothing.",
};

// Only offer actions that make sense right now. Criteria are sent fresh on
// every request, so the choice set can change tick by tick: Jev can't pick
// FREEZE while it's recharging, or SEEK_HEALTH when there's no health pack.
export function availableActions(req: DecisionRequest): JevAction[] {
  return JEV_ACTIONS.filter((a) => {
    switch (a) {
      case "APPROACH_ENEMY":
      case "EVADE":
        return req.nearestEnemy !== null;
      case "SEEK_HEALTH":
        return req.nearestHealthPack !== null;
      case "FREEZE":
        return req.freezeRechargeSeconds === 0 && req.nearestEnemy !== null;
      default:
        return true;
    }
  });
}

// The user's instruction goes into the question itself, not into the state.
// The instruction is *how to decide*; the state is *what is true right now*.
// With this split, "Attack them" vs "get to the exit" on identical state swings
// the choice from APPROACH_ENEMY ~1.00 to SEEK_EXIT ~0.95 (npm run check-jev).
function actionInstructions(instruction: string): string {
  return [
    `You control a character in a top-down game. Its commander has ordered: "${instruction}"`,
    "Choose the single action that best carries out that order, given the character's current situation.",
  ].join("\n");
}

// Keep the state short and in plain words. Jev reads it; nothing parses it.
function describeState(req: DecisionRequest): Record<string, unknown> {
  const place = (p: { distance: number; direction: string }) => ({
    distance: `${Math.round(p.distance)} units`,
    direction: p.direction,
  });
  return {
    health: `${Math.round(req.playerHealth)}%`,
    enemies: {
      remaining: req.enemiesRemaining,
      withinFreezeRange: req.enemiesInFreezeRange,
      nearest: req.nearestEnemy
        ? {
            ...place(req.nearestEnemy),
            dangerouslyClose: req.nearestEnemy.dangerouslyClose,
            status: req.nearestEnemy.frozen ? "FROZEN: cannot move or attack right now" : "active",
          }
        : "none remaining",
    },
    freezePower:
      req.freezeRechargeSeconds === 0 ? "ready" : `recharging, ready in ${Math.ceil(req.freezeRechargeSeconds)} seconds`,
    nearestHealthPack: req.nearestHealthPack ? place(req.nearestHealthPack) : "none on the map",
    exit: place(req.exit),
  };
}

export async function decide(client: OpenRouter, req: DecisionRequest): Promise<DecisionResponse> {
  const started = Date.now();
  const offered = availableActions(req);

  const res = await client.alpha.decisions.create({
    decisionsRequest: {
      model: JEV_MODEL,
      state: describeState(req),
      // Several questions batch into one request at no extra round trip.
      // `action` is a Choice (pick one label); `danger` is a Noul (yes/no).
      questions: {
        action: {
          type: "choice",
          instructions: actionInstructions(req.instruction),
          criteria: Object.fromEntries(offered.map((a) => [a, ACTION_CRITERIA[a]])),
        },
        danger: {
          type: "noul",
          instructions: "Is the character in immediate danger of being hurt?",
        },
      },
    },
  });

  const action = res.answers.action;
  if (action?.type !== "choice" || !isJevAction(action.choice) || !offered.includes(action.choice)) {
    throw new Error(`Unexpected Jev answer for "action": ${JSON.stringify(action)}`);
  }
  const danger = res.answers.danger;

  return {
    action: action.choice,
    offered,
    probabilities: Object.fromEntries(
      JEV_ACTIONS.map((a) => [a, action.probabilities?.[a] ?? 0]),
    ) as Record<JevAction, number>,
    confidence: action.confidence ?? 0,
    danger: danger?.type === "noul" ? danger.noul : null,
    latencyMs: Date.now() - started,
    costUsd: res.usage.cost ?? null,
  };
}

function isJevAction(value: string): value is JevAction {
  return (JEV_ACTIONS as readonly string[]).includes(value);
}
