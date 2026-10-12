// The repository's files as git sees them, so every check reads the same set: tracked files and
// untracked ones that are not ignored, never `node_modules` or build output.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

/** The repository's files, as paths relative to `root` with `/` separators, sorted. */
export function repoFiles(root: string): string[] {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" },
  );
  const paths = new Set(
    listed
      .split("\0")
      // A tracked file deleted from the working tree is still listed, and a nested repository, a
      // submodule, or a link to a directory is listed as a path; only the files present are read.
      .filter((path) => statSync(join(root, path), { throwIfNoEntry: false })?.isFile() === true),
  );
  return [...paths].toSorted();
}
