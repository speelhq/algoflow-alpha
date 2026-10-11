// What the judge sees of a run: final main-level variables as Data, stdout, and draws.
// Shared by the stores (which run in batches) and scripts/check.ts (which drains a run at once).
import { toData } from "@/lang/data";
import type { Data, Id } from "@/lang/types";
import type { Done, Runner, State } from "./types";

export type Outcome = {
  done: Done;
  stdout: string[];
  vars: Record<Id, Data>;
  draws: number[];
};

/** Calls `next()` up to `limit` times; returns the `Done` when the run finishes within the batch. */
export function advance(runner: Runner, limit: number): Done | undefined {
  for (let i = 0; i < limit; i += 1) {
    const next = runner.next();
    if (next.type === "done" || next.type === "error") return next;
  }
  return undefined;
}

/** The main-level variables as Data: what the judge compares and the `Result` rows show. */
export function mainVars(state: State): Record<Id, Data> {
  const vars: Record<Id, Data> = {};
  for (const [name, value] of state.frames[0]?.vars ?? []) vars[name] = toData(value, state.heap);
  return vars;
}

export function outcomeOf(runner: Runner, done: Done): Outcome {
  return { done, stdout: runner.stdout(), vars: mainVars(runner.state()), draws: runner.draws() };
}
