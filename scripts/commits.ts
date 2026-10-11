// `pnpm commits <base>..<head>` checks the message of every commit in the range, as CI does for
// the commits of a pull request.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { commitProblems, scopesOf } from "./lib/commits";

const root = fileURLToPath(new URL("..", import.meta.url));
const [range] = process.argv.slice(2);
if (range === undefined) {
  console.error("usage: pnpm commits <base>..<head>");
  process.exit(2);
}

const scopes = scopesOf(root);
// Each commit is its hash and its message, each ended by a NUL.
const log = execFileSync("git", ["log", "--format=%H%x00%B%x00", range], {
  cwd: root,
  encoding: "utf8",
});
const fields = log.split("\0");
let count = 0;
let failed = 0;
for (let i = 0; i + 1 < fields.length; i += 2) {
  const hash = (fields[i] ?? "").trim();
  const message = fields[i + 1] ?? "";
  const problems = commitProblems(message, scopes);
  count += 1;
  if (problems.length === 0) continue;
  failed += 1;
  console.log(`FAIL ${hash.slice(0, 7)} ${message.split("\n")[0] ?? ""}`);
  for (const problem of problems) console.log(`     ${problem}`);
}
console.log(`commits: ${count - failed}/${count} ok`);
process.exit(failed > 0 ? 1 : 0);
