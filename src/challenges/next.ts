// A plan's button on the Problems page, and where `Next problem →` leads. Status comes in as
// a function so this module stays below the stores.
import { planOf } from "./plans";

export type Status = (id: string) => "attempted" | "solved" | undefined;

export type PlanAction = { kind: "start" | "continue"; id: string } | null;

/** `Start` before any entry, `Continue` to the first unsolved problem, else nothing. */
export function planAction(problems: readonly string[], status: Status): PlanAction {
  const first = problems[0];
  if (first === undefined) return null;
  if (problems.every((id) => status(id) === undefined)) return { kind: "start", id: first };
  const unsolved = problems.find((id) => status(id) !== "solved");
  return unsolved === undefined ? null : { kind: "continue", id: unsolved };
}

export type NextProblem = { kind: "next"; id: string } | { kind: "complete" };

/**
 * The next unsolved problem of `id`'s plan after it (wrapping round); once every other one
 * is solved, the next row; after the last row, `Plan complete`.
 */
export function nextProblem(id: string, status: Status): NextProblem {
  const rows = planOf(id).problems;
  const at = rows.indexOf(id);
  const after = [...rows.slice(at + 1), ...rows.slice(0, at)];
  const unsolved = after.find((other) => status(other) !== "solved");
  if (unsolved !== undefined) return { kind: "next", id: unsolved };
  const following = rows[at + 1];
  return following === undefined ? { kind: "complete" } : { kind: "next", id: following };
}
