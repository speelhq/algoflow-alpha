import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoFiles } from "./lib/files";
import { checkI18n, formatReport, usagesIn } from "./lib/i18n-check";

let root: string;

function write(rel: string, text: string) {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

function run() {
  return checkI18n({ root, files: repoFiles(root), i18nDir: join(root, "src", "i18n") });
}

describe("scripts/i18n (U-71)", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "algoflow-i18n-"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    write("src/i18n/en.json", JSON.stringify({ app: { name: "AlgoFlow", saved: "Saved" } }));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("passes when every t() literal key exists", () => {
    write("src/ui/a.tsx", 'const x = t("app.name");\nconst y = t("app.saved", { n: 1 });');
    const report = run();
    expect(report.unknown).toEqual([]);
    expect(report.usages).toBe(2);
    expect(formatReport(report).at(-1)).toBe("i18n: 2 keys, 2 usages, ok");
  });

  it("fails on an unknown literal key with file and line", () => {
    write("src/ui/b.tsx", 'const a = t("app.name");\n\nconst b = t("app.nope");');
    const report = run();
    expect(report.unknown).toEqual([{ file: "src/ui/b.tsx", line: 3, key: "app.nope" }]);
    expect(formatReport(report)[0]).toBe('src/ui/b.tsx:3 unknown key "app.nope"');
  });

  it("ignores test files and calls that are not t()", () => {
    write("src/ui/c.test.tsx", 'expect(t("app.nope"))');
    write("src/ui/d.ts", 'list.at("app.nope"); obj.t("app.nope"); format("app.nope")');
    expect(run().usages).toBe(0);
    expect(usagesIn(join(root, "src/ui/d.ts"), root)).toEqual([]);
  });

  it("checks key parity with ja.json once it exists", () => {
    write("src/i18n/ja.json", JSON.stringify({ app: { name: "アルゴフロー", extra: "x" } }));
    const report = run();
    expect(report.missing).toEqual([
      { locale: "ja", key: "app.saved" },
      { locale: "en", key: "app.extra" },
    ]);
  });
});
