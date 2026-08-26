import type { NavexClient } from "./client";
import type { ActionResult, AgentAction, PageState, TurnResponse } from "./types";

export interface StepInfo {
  step: number;
  thought?: string;
}

export interface FinalInfo {
  reason: "complete" | "failed" | "max_steps";
  message: string;
}

export interface RunTurnCallbacks {
  onStep?: (info: StepInfo) => void;
  onFinal?: (info: FinalInfo) => void;
}

export interface RunTurnArgs {
  client: NavexClient;
  sessionId: string;
  message: string;
  execute: (action: AgentAction) => Promise<ActionResult>;
  observe: () => PageState;
  maxRounds?: number;
  callbacks?: RunTurnCallbacks;
}

const CLIENT_SIDE_STEP_GUARD = 20;

export async function runTurn(args: RunTurnArgs): Promise<TurnResponse> {
  const { client, sessionId, message, execute, observe, callbacks } = args;
  const maxRounds = args.maxRounds ?? CLIENT_SIDE_STEP_GUARD;

  let turn: TurnResponse = await client.chat(sessionId, message, observe());
  let rounds = 0;

  while (turn.type === "action") {
    if (rounds >= maxRounds) {
      const aborted: Extract<TurnResponse, { type: "final" }> = {
        type: "final",
        reason: "failed",
        message: "I stopped after too many steps.",
      };
      callbacks?.onFinal?.(aborted);
      return aborted;
    }
    rounds += 1;
    callbacks?.onStep?.({ step: turn.step, thought: turn.thought });

    const result = await execute(turn.action);
    turn = await client.observation(sessionId, result);
  }

  if (turn.type === "final") {
    callbacks?.onFinal?.({ reason: turn.reason, message: turn.message });
  }
  return turn;
}
