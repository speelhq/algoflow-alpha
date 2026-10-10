import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoFiles } from "./lib/files";

let root: string;

function write(rel: string, text: string) {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "algoflow-files-"));
  git(root, "init", "-q");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("repoFiles", () => {
  it("lists tracked and untracked files, never ignored ones or a nested repository", () => {
    write(".gitignore", "dist/\n");
    write("src/a.ts", "a");
    write("dist/out.js", "built");
    write("notes.md", "untracked");
    write("gone.md", "deleted");
    git(root, "add", "src/a.ts", "gone.md", ".gitignore");
    rmSync(join(root, "gone.md"));
    mkdirSync(join(root, "worktree"));
    git(join(root, "worktree"), "init", "-q");
    write("worktree/copy.md", "another checkout");
    symlinkSync(join(root, "src"), join(root, "linked"));
    git(root, "add", "linked");
    expect(repoFiles(root)).toEqual([".gitignore", "notes.md", "src/a.ts"]);
  });

  it("ignores a contributor's global ignore file", () => {
    write("notes.md", "untracked");
    write("global/config", `[core]\n\texcludesFile = ${join(root, "global", "ignore")}\n`);
    write("global/ignore", "notes.md\n");
    const global = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = join(root, "global", "config");
    try {
      expect(repoFiles(root)).toContain("notes.md");
    } finally {
      if (global === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = global;
    }
  });
});
