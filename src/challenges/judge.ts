// One test verdict, shared by Run, Submit, and scripts/check.ts: a finished run passes when no
// row of the `Result` tab differs.
import type { Outcome } from "@/runtime/outcome";
import type { RuntimeError } from "@/runtime/types";
import { firstDifference, resultRows, type Rows } from "./rows";
import type { Test } from "./types";

export type TestResult =
  | { status: "pass" }
  | { status: "fail"; rows: Rows }
  | { status: "error"; error: RuntimeError };

export function judge(test: Test, outcome: Outcome): TestResult {
  if (outcome.done.type === "error") return { status: "error", error: outcome.done.error };
  const rows = resultRows(test.expect, outcome);
  return firstDifference(rows) === null ? { status: "pass" } : { status: "fail", rows };
}
