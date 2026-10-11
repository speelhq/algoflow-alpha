// The rows of the `Result` tab for one case, and the first one that differs; the judge passes a
// finished run exactly when none differs (`judge.ts`).
import { dataEquals } from "@/lang/data";
import type { Data, Id } from "@/lang/types";
import type { Test } from "./types";

/** `Output` beside `Expected`, aligned by position; a side with no such line is absent. */
export type OutputRow = { line: number; actual?: string; expected?: string; differs: boolean };
/** One expected variable; `actual` is absent when the program never created it. */
export type VariableRow = { name: Id; actual?: Data; expected: Data; differs: boolean };
export type Rows = { output: OutputRow[]; variables: VariableRow[] };
export type FirstDifference = { kind: "output"; line: number } | { kind: "variable"; name: Id };
/** `line` (1-based) when a `print` produced the differing line; absent at the end of the run. */
export type WatchStep = { step: number; line?: number };

/**
 * `expect` is absent for a Playground program: the output rows then
 * carry no `expected`. `differs` compares the values as they are now, so the tab marks a
 * row only once the run has ended. Lines are 1-based.
 */
export function resultRows(
  expect: Test["expect"] | undefined,
  actual: { stdout: string[]; vars: Record<Id, Data> },
): Rows {
  const lines = expect?.stdout;
  const output: OutputRow[] = [];
  for (let i = 0; i < Math.max(actual.stdout.length, lines?.length ?? 0); i += 1) {
    const row: OutputRow = { line: i + 1, differs: false };
    if (i < actual.stdout.length) row.actual = actual.stdout[i] ?? "";
    if (lines && i < lines.length) row.expected = lines[i] ?? "";
    row.differs = lines !== undefined && row.actual !== row.expected;
    output.push(row);
  }
  const variables = Object.entries(expect?.variables ?? {}).map(([name, expected]) => {
    const row: VariableRow = { name, expected, differs: true };
    if (Object.hasOwn(actual.vars, name)) {
      row.actual = actual.vars[name] ?? null;
      row.differs = !dataEquals(expected, row.actual);
    }
    return row;
  });
  return { output, variables };
}

/** The first output row that differs, or else the first variable row that differs. */
export function firstDifference(rows: Rows): FirstDifference | null {
  const line = rows.output.find((row) => row.differs);
  if (line) return { kind: "output", line: line.line };
  const variable = rows.variables.find((row) => row.differs);
  return variable ? { kind: "variable", name: variable.name } : null;
}

/**
 * The step `Watch this case` opens at: the `print` that produced the first differing
 * line, or the last step of the run when no `print` produced it or a variable differs.
 * `prints[i]` is the visible step of output line `i + 1`.
 */
export function watchStep(
  difference: FirstDifference | null,
  prints: number[],
  total: number,
): WatchStep {
  const step = difference?.kind === "output" ? prints[difference.line - 1] : undefined;
  return step === undefined || difference?.kind !== "output"
    ? { step: total }
    : { step, line: difference.line };
}
