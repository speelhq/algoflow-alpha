// Every `t("...")` literal key in src/ must exist in en.json;
// once ja.json exists, both catalogs must have the same key set.
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { flatten } from "../../src/i18n/flatten";
import { lineOf, lineStarts } from "./lines";

export type Usage = { file: string; line: number; key: string };
export type Missing = { locale: string; key: string };
export type I18nReport = {
  keys: number;
  usages: number;
  unknown: Usage[];
  missing: Missing[];
};

/** The sources scanned: `src/` code, tests and declarations aside. */
const SOURCE = /^src\/.*\.(ts|tsx)$/;
const SKIP = /(\.test\.(ts|tsx)|\.d\.ts)$/;
// `t("key"` or `t('key'` not preceded by an identifier character or a dot
// (so `at(` and `x.t(` are ignored). Lexical: comments are scanned too.
const USAGE = /(?<![\w.$])t\(\s*(["'])([^"'`]+)\1/g;

export function usagesIn(file: string, root: string): Usage[] {
  const text = readFileSync(file, "utf8");
  const rel = relative(root, file).replaceAll("\\", "/");
  const starts = lineStarts(text);
  return [...text.matchAll(USAGE)].map((match) => ({
    file: rel,
    line: lineOf(starts, match.index),
    key: match[2] ?? "",
  }));
}

/** Checks the keys used in `files` (paths relative to `root`, as `repoFiles` lists them). */
export function checkI18n(opts: {
  root: string;
  files: readonly string[];
  i18nDir: string;
}): I18nReport {
  const en = flatten(JSON.parse(readFileSync(join(opts.i18nDir, "en.json"), "utf8")));
  const enKeys = new Set(Object.keys(en));

  const usages = opts.files
    .filter((file) => SOURCE.test(file) && !SKIP.test(file))
    .flatMap((file) => usagesIn(join(opts.root, file), opts.root));
  const unknown = usages.filter((u) => !enKeys.has(u.key));

  const missing: Missing[] = [];
  const jaPath = join(opts.i18nDir, "ja.json");
  if (existsSync(jaPath)) {
    const ja = flatten(JSON.parse(readFileSync(jaPath, "utf8")));
    const jaKeys = new Set(Object.keys(ja));
    for (const key of enKeys) if (!jaKeys.has(key)) missing.push({ locale: "ja", key });
    for (const key of jaKeys) if (!enKeys.has(key)) missing.push({ locale: "en", key });
  }

  return { keys: enKeys.size, usages: usages.length, unknown, missing };
}

export function formatReport(report: I18nReport): string[] {
  const lines = report.unknown.map((u) => `${u.file}:${u.line} unknown key "${u.key}"`);
  for (const m of report.missing) lines.push(`${m.locale}.json missing key "${m.key}"`);
  lines.push(
    `i18n: ${report.keys} keys, ${report.usages} usages, ${lines.length === 0 ? "ok" : `${lines.length} problem(s)`}`,
  );
  return lines;
}
