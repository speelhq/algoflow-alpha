// PreToolUse (Bash): run `pnpm lint` before any `git commit`, `git -C <dir> commit`
// included and `git commit-tree` not; deny the commit on failure.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const command = input.tool_input?.command ?? "";
if (!/\bgit(?:\s+-[Cc]\s+\S+)*\s+commit(?![\w-])/.test(command)) process.exit(0);

if (!existsSync(join(root, "package.json"))) {
  console.error("lint-before-commit: no package.json yet, skipping pnpm lint");
  process.exit(0);
}

const result = spawnSync("pnpm", ["lint"], {
  cwd: root,
  encoding: "utf8",
});
if (result.status === 0) process.exit(0);

const output = ((result.stdout ?? "") + (result.stderr ?? "")).trim().slice(-4000);
console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `pnpm lint failed; fix the errors before committing.\n${output}`,
    },
  }),
);
process.exit(0);
