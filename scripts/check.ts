// Schema, validation, interpreter, and CPython agreement for
// every challenge (or the files given as arguments), then the i18n check.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { judge } from "@/challenges/judge";
import { resultRows, type Rows } from "@/challenges/rows";
import { seedOf, type Challenge, type Test } from "@/challenges/types";
import { emit } from "@/python/emit";
import { checkChallengeSchema } from "./lib/challenge";
import { runPython } from "./lib/cpython";
import { repoFiles } from "./lib/files";
import { checkI18n, formatReport } from "./lib/i18n-check";
import { execute } from "./lib/interp";
import { checkPlans } from "./lib/plans";

const root = fileURLToPath(new URL("..", import.meta.url));
const PLANS_FILE = "plans.json";
const args = process.argv.slice(2);
/** `ja` texts are checked in every file once the Japanese catalog exists. */
const requireJa = existsSync(join(root, "src", "i18n", "ja.json"));
/** Every challenge file on disk; `plans.json` sits beside them and is checked separately. */
const allFiles = readdirSync(join(root, "challenges"))
  .filter((f) => f.endsWith(".json") && f !== PLANS_FILE)
  .toSorted()
  .map((f) => join(root, "challenges", f));
const files =
  args.length > 0
    ? args.map((a) => resolve(a)).filter((f) => basename(f) !== PLANS_FILE)
    : allFiles;

/** What each differing row says: its line or variable, what was expected, and what came. */
function differences(rows: Rows): string[] {
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

/** One test: interpreter result against `expect`, then CPython against the interpreter. */
function checkTest(challenge: Challenge, test: Test, index: number): string[] {
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
  const python = runPython(code, outcome.draws, Object.keys(outcome.vars));
  if ("error" in python) return [...problems, `${label}: python3 failed: ${python.error}`];
  // CPython is held to what the interpreter produced: every line and every variable of `main`.
  const agreement = resultRows({ stdout: outcome.stdout, variables: outcome.vars }, python);
  return [...problems, ...differences(agreement).map((d) => `${label}: CPython ${d}`)];
}

type Checked = { problems: string[]; summary: string };

/** Reads one file as JSON, checks it, and reports `ok` or `FAIL`; true when it passed. */
function checkFile(path: string, name: string, check: (json: unknown) => Checked): boolean {
  let checked: Checked;
  try {
    checked = check(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    checked = { problems: [error instanceof Error ? error.message : String(error)], summary: "" };
  }
  if (checked.problems.length > 0) {
    console.log(`FAIL ${name}`);
    for (const problem of checked.problems) console.log(`     ${problem}`);
    return false;
  }
  console.log(`ok   ${name} (${checked.summary})`);
  return true;
}

let failed = 0;
for (const file of files) {
  const id = basename(file, ".json");
  const passed = checkFile(file, id, (json) => {
    const { challenge, problems } = checkChallengeSchema(json, id, { requireJa });
    if (challenge)
      challenge.tests.forEach((test, i) => problems.push(...checkTest(challenge, test, i)));
    return {
      problems,
      summary: `${challenge?.tests.length ?? 0} tests, interpreter and CPython agree`,
    };
  });
  if (!passed) failed += 1;
}
if (files.length > 0) console.log(`challenges: ${files.length - failed}/${files.length} ok`);

// The plans against every challenge file on disk, whatever files were given.
const knownIds = new Set(allFiles.map((f) => basename(f, ".json")));
const plansPassed = checkFile(join(root, "challenges", PLANS_FILE), "plans", (json) => {
  const { plans, problems } = checkPlans(json, knownIds, { requireJa });
  const listed = plans ?? [];
  const count = listed.reduce((n, plan) => n + plan.problems.length, 0);
  return { problems, summary: `${listed.length} plan(s), ${count} problems` };
});
if (!plansPassed) failed += 1;

const repository = repoFiles(root);
const i18n = checkI18n({ root, files: repository, i18nDir: join(root, "src", "i18n") });
for (const line of formatReport(i18n)) console.log(line);
const i18nFailed = i18n.unknown.length + i18n.missing.length > 0;

process.exit(failed > 0 || i18nFailed ? 1 : 0);
