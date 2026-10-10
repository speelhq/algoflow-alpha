// The check of a diamond: its condition as true or false, ending in one `compare` of the whole
// condition, the condition's own when it is a comparison.
import type { Expr } from "@/lang/types";
import type { RunContext } from "@/nodes/types";
import type { Event } from "./types";
import { truthy } from "./values";

/**
 * Evaluates `cond`, passing on its events, and adds its `compare` unless the last event was it.
 * Only the last event counts: a call inside `cond` can reach the same diamond in another frame,
 * and every call ends in its `return` event.
 */
export function* decide(cond: Expr, ctx: RunContext): Generator<Event, boolean, void> {
  const evaluation = ctx.eval(cond);
  let last: Event | undefined;
  for (;;) {
    const step = evaluation.next();
    if (step.done) {
      const result = truthy(step.value, ctx.heap);
      if (last?.type !== "compare" || last.nodeId !== cond.id) {
        yield { type: "compare", nodeId: cond.id, result };
      }
      return result;
    }
    last = step.value;
    yield step.value;
  }
}
