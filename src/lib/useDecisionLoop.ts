// Asks Jev for a new decision roughly every 500ms, independently of rendering.
//
// Rules (SPEC.md "Loop scheduling"):
//  - single-flight: if a request is still in flight when a tick is due, skip the tick
//  - stale responses (from before a reset or instruction change) are discarded
//  - fail soft: on error keep the last decision, surface the error, keep ticking

import { useEffect, useRef, useState } from "react";
import type { DecisionRequest, DecisionResponse } from "../../shared/types.ts";
import { requestDecision } from "./api.ts";

const TICK_MS = 500;

export type DecisionLoopState = {
  lastRequest: DecisionRequest | null;
  lastDecision: DecisionResponse | null;
  inFlight: boolean;
  error: string | null;
  requests: number;
  skippedTicks: number;
  totalCostUsd: number;
};

const initial: DecisionLoopState = {
  lastRequest: null,
  lastDecision: null,
  inFlight: false,
  error: null,
  requests: 0,
  skippedTicks: 0,
  totalCostUsd: 0,
};

/**
 * @param buildRequest returns the current state to decide on, or null to pause
 * @param epoch change this to invalidate any in-flight response (reset, new instruction)
 */
export function useDecisionLoop(buildRequest: () => DecisionRequest | null, epoch: number) {
  const [state, setState] = useState(initial);
  const inFlight = useRef(false);
  const epochRef = useRef(epoch);
  const buildRef = useRef(buildRequest);
  buildRef.current = buildRequest;

  // A new epoch drops the previous decision: it was made for a world or
  // instruction that no longer exists.
  useEffect(() => {
    epochRef.current = epoch;
    setState((s) => ({ ...s, lastDecision: null, error: null }));
  }, [epoch]);

  useEffect(() => {
    const tick = async () => {
      const req = buildRef.current();
      if (!req) return;
      if (inFlight.current) {
        setState((s) => ({ ...s, skippedTicks: s.skippedTicks + 1 }));
        return;
      }

      const sentEpoch = epochRef.current;
      inFlight.current = true;
      setState((s) => ({ ...s, inFlight: true, lastRequest: req, requests: s.requests + 1 }));

      try {
        const decision = await requestDecision(req);
        if (sentEpoch !== epochRef.current) return; // stale: world or instruction changed meanwhile
        setState((s) => ({
          ...s,
          lastDecision: decision,
          error: null,
          totalCostUsd: s.totalCostUsd + (decision.costUsd ?? 0),
        }));
      } catch (err) {
        if (sentEpoch !== epochRef.current) return;
        setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        inFlight.current = false;
        setState((s) => ({ ...s, inFlight: false }));
      }
    };

    void tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return state;
}
