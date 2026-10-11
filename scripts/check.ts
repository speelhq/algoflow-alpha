// Schema, validation, interpreter, and CPython agreement for
// every challenge (or the files given as arguments), then the i18n check.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkTest } from "./lib/agreement";
import { checkChallengeSchema } from "./lib/challenge";
import { runPython } from "./lib/cpython";
import { repoFiles } from "./lib/files";
import { checkI18n, formatReport } from "./lib/i18n-check";
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
      challenge.tests.forEach((test, i) =>
        problems.push(...checkTest(challenge, test, i, runPython)),
      );
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
