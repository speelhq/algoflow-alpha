// The rules a commit message follows (CLAUDE.md, Issues and commits), for the commits
// of a pull request.
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** The Conventional Commits types. */
const TYPES: ReadonlySet<string> = new Set([
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
]);
/** A subject is under 50 characters. */
const LONGEST = 49;
const SUBJECT = /^([a-z]+)(?:\(([^()]*)\))?!?: \S/;
/** A trailer line as git reads one: a token, a colon, and a value. */
const TRAILER = /^[A-Za-z0-9][A-Za-z0-9-]*: /;
/** What `git commit --fixup` and `--squash` write, left for an autosquash. */
const UNFOLDED = /^(fixup|squash|amend)! /;

/** The scopes a commit may name: each folder of `src/`, and `scripts`, `docs`, and `ci`. */
export function scopesOf(root: string): Set<string> {
  const folders = readdirSync(join(root, "src"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return new Set([...folders, "scripts", "docs", "ci"]);
}

/** What is wrong with a commit message; empty when it follows every rule. */
export function commitProblems(message: string, scopes: ReadonlySet<string>): string[] {
  const [subject = "", ...rest] = message.trimEnd().split("\n");
  const problems: string[] = [];
  const parts = SUBJECT.exec(subject);
  if (UNFOLDED.test(subject)) problems.push("a fixup or squash is left unfolded");
  else if (!parts) problems.push("the subject is not `<type>(<scope>): <summary>`");
  else {
    const [, type = "", scope] = parts;
    if (!TYPES.has(type)) problems.push(`"${type}" is not a Conventional Commits type`);
    if (scope !== undefined && !scopes.has(scope))
      problems.push(`"${scope}" is not a scope: a folder of src/, or scripts, docs, or ci`);
  }
  if (subject.length > LONGEST)
    problems.push(`the subject has ${subject.length} characters, more than ${LONGEST}`);
  const body = rest.join("\n").trim();
  const last = (body.split(/\n\s*\n/).at(-1) ?? "").split("\n");
  // A trailer's value may go on over lines that start with a space, as git reads them.
  if (
    body !== "" &&
    TRAILER.test(last[0] ?? "") &&
    last.every((line) => TRAILER.test(line) || /^\s/.test(line))
  )
    problems.push("the message ends in a trailer");
  return problems;
}
