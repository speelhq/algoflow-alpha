// One challenge test checked twice: the interpreter's result against `expect`, then CPython's
// against the interpreter's.
import { judge } from "@/challenges/judge";
import { resultRows, type Rows } from "@/challenges/rows";
import { seedOf, type Challenge, type Test } from "@/challenges/types";
import type { Id } from "@/lang/types";
import { emit } from "@/python/emit";
import type { PythonResult } from "./cpython";
import { execute } from "./interp";

/** Runs emitted Python with the draws to replay, reporting the named variables of `main`. */
export type PythonRunner = (code: string, draws: number[], names: Id[]) => PythonResult;

/** What each differing row says: its line or variable, what was expected, and what came. */
export function differences(rows: Rows): string[] {
  const shown = (value: unknown) => (value === undefined ? "nothing" : JSON.stringify(value));
  return [
    ...rows.output
      .filter((row) => row.differs)
      .map((row) => `line ${row.line}: expected ${shown(row.expected)}, got ${shown(row.actual)}`),
    ...rows.variables
      .filter((row) => row.differs)
      .map((row) =>
        row.actual === undefined
          ? `variable ${row.name} was never assigned`
          : `${row.name}: expected ${shown(row.expected)}, got ${shown(row.actual)}`,
      ),
  ];
}

/** Test `index` of a challenge: the problems found, each starting with the test it is about. */
export function checkTest(
  challenge: Challenge,
  test: Test,
  index: number,
  python: PythonRunner,
): string[] {
  const label = `test[${index}] ${JSON.stringify(test.inputs)}`;
  const outcome = execute(challenge.solution, test.inputs, seedOf(test));
  const verdict = judge(test, outcome);
  if (verdict.status === "error") {
    const { code, nodeId, params } = verdict.error;
    return [`${label}: interpreter ${code} at ${nodeId} ${JSON.stringify(params)}`];
  }
  const problems =
    verdict.status === "fail" ? differences(verdict.rows).map((d) => `${label}: ${d}`) : [];

  const code = emit(challenge.solution, test.inputs).code;
  const result = python(code, outcome.draws, Object.keys(outcome.vars));
  if ("error" in result) return [...problems, `${label}: python3 failed: ${result.error}`];
  // CPython is held to what the interpreter produced: every line and every variable of `main`.
  const agreement = resultRows({ stdout: outcome.stdout, variables: outcome.vars }, result);
  return [...problems, ...differences(agreement).map((d) => `${label}: CPython ${d}`)];
}
