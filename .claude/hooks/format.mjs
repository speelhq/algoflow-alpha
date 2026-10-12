// PostToolUse (Write|Edit): run oxfmt on the edited file when it is inside the repository; oxfmt
// itself skips the paths `.oxfmtrc.json` ignores and the files it does not format.
import { readFileSync, existsSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const file = input.tool_response?.filePath || input.tool_input?.file_path;
if (!file) process.exit(0);

const rel = relative(root, file);
if (rel === "" || rel.split("/")[0] === ".." || isAbsolute(rel)) process.exit(0);
if (!existsSync(join(root, "package.json"))) process.exit(0);

spawnSync("pnpm", ["exec", "oxfmt", "--no-error-on-unmatched-pattern", rel], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
});
process.exit(0);
