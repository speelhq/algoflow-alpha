// The commit-message check (CLAUDE.md, Issues and commits).
import { describe, expect, it } from "vitest";
import { commitProblems, scopesOf } from "./lib/commits";

const scopes = new Set(["lang", "ui", "scripts", "docs", "ci"]);
const check = (message: string) => commitProblems(message, scopes);

describe("commitProblems", () => {
  it("accepts a type with or without a scope, a short subject, and a body", () => {
    expect(check("fix(lang): keep ids unique\n")).toEqual([]);
    expect(check("docs: name the scopes")).toEqual([]);
    expect(check("feat(ui)!: drop the old view\n\nThe view moved.\nIt reads the store.\n")).toEqual(
      [],
    );
  });

  it("refuses a subject that is not a Conventional Commit, an unknown type, or an unknown scope", () => {
    expect(check("Keep ids unique")).toEqual(["the subject is not `<type>(<scope>): <summary>`"]);
    expect(check("feature(lang): keep ids")).toEqual([
      '"feature" is not a Conventional Commits type',
    ]);
    expect(check("fix(store): keep ids")).toEqual([
      '"store" is not a scope: a folder of src/, or scripts, docs, or ci',
    ]);
  });

  it("refuses a subject of 50 characters or more", () => {
    const subject = `fix: ${"a".repeat(45)}`;
    expect(check(subject.slice(0, 49))).toEqual([]);
    expect(check(subject)).toEqual(["the subject has 50 characters, more than 49"]);
  });

  it("refuses a message ending in trailers, and a fixup or squash left unfolded", () => {
    expect(check("fix: keep ids\n\nThe reason.\n\nCo-Authored-By: someone <a@b.c>\n")).toEqual([
      "the message ends in a trailer",
    ]);
    expect(check("fix: keep ids\n\nReviewed-by: a\nSigned-off-by: b")).toEqual([
      "the message ends in a trailer",
    ]);
    expect(check("fix: keep ids\n\nCo-Authored-By: someone\n <a@b.c>")).toEqual([
      "the message ends in a trailer",
    ]);
    expect(check("fix: keep ids\n\nThe reason:\nthe store reads it first.")).toEqual([]);
    expect(check("fixup! fix: keep ids")).toEqual(["a fixup or squash is left unfolded"]);
    expect(check("squash! fix: keep ids")).toEqual(["a fixup or squash is left unfolded"]);
  });
});

describe("scopesOf", () => {
  it("names each folder of src/, and scripts, docs, and ci", () => {
    const found = scopesOf(".");
    for (const scope of ["lang", "nodes", "runtime", "python", "store", "ui", "scripts", "ci"])
      expect(found.has(scope), scope).toBe(true);
    expect(found.has("main.tsx")).toBe(false);
  });
});
