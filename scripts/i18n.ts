// `pnpm check` runs this after scripts/check.ts.
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { repoFiles } from "./lib/files";
import { checkI18n, formatReport } from "./lib/i18n-check";

const root = fileURLToPath(new URL("..", import.meta.url));
const report = checkI18n({
  root,
  files: repoFiles(root),
  i18nDir: join(root, "src", "i18n"),
});

for (const line of formatReport(report)) console.log(line);
process.exit(report.unknown.length + report.missing.length === 0 ? 0 : 1);
