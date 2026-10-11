// The list under a value line: the groups chosen by what is before the caret, in one
// order everywhere, or the rows a typed word matches; `Show all` lists every entry that can be
// chosen there. Reads the entries' `group` and `on` only.
import type { Kind } from "@/lang/types";
import type { MenuGroup } from "@/nodes/types";
import { allEntries, GROUPS, takesValue } from "./entries";
import { atInput, kindBefore, matches, type Line, type LineContext, type Row } from "./line";

export type ListGroup = "variables" | MenuGroup | "functions";
const LIST_GROUPS: readonly ListGroup[] = ["variables", ...GROUPS, "functions"];

export type Section = { group: ListGroup; rows: Row[] };

/** The group a row is listed under. */
function groupOf(row: Row): ListGroup {
  switch (row.kind) {
    case "variable":
      return "variables";
    case "entry":
      return row.entry.menu.group;
    case "brackets":
      return "calculate";
    case "function":
      return "functions";
  }
}

function sections(rows: readonly Row[]): Section[] {
  return LIST_GROUPS.map((group) => ({
    group,
    rows: rows.filter((row) => groupOf(row) === group),
  })).filter((section) => section.rows.length > 0);
}

/** The rows offered where a value is expected; with `all`, every entry too. */
function expected(ctx: LineContext, all: boolean): Row[] {
  const offered = allEntries().filter((entry) => all || !takesValue(entry));
  // The brackets follow the calculations offered where a value is expected.
  const last = offered.findLastIndex(
    (entry) => entry.menu.group === "calculate" && !takesValue(entry),
  );
  const entries = offered.map((entry): Row => ({ kind: "entry", entry }));
  entries.splice(last + 1, 0, { kind: "brackets" });
  return [
    ...ctx.variables.map((name): Row => ({ kind: "variable", name })),
    ...entries,
    ...ctx.functions.map((fn): Row => ({ kind: "function", fn })),
  ];
}

/** The entries offered after a value of `kind`; every one that takes a value when it is unknown. */
function after(kind: Kind | undefined, all: boolean): Row[] {
  return allEntries()
    .filter(
      (entry) => takesValue(entry) && (all || kind === undefined || entry.menu.on?.includes(kind)),
    )
    .map((entry): Row => ({ kind: "entry", entry }));
}

/** The list's sections at the caret, or the matches of the word typed, in their rank. */
export function listSections(line: Line, ctx: LineContext, all = false): Section[] {
  if (line.word !== "") {
    // Matches keep their rank; a heading starts wherever the group changes.
    const out: Section[] = [];
    for (const row of matches(line, ctx)) {
      const group = groupOf(row);
      const last = out.at(-1);
      if (last?.group === group) last.rows.push(row);
      else out.push({ group, rows: [row] });
    }
    return out;
  }
  return sections(atInput(line) ? expected(ctx, all) : after(kindBefore(line, ctx), all));
}

/** The rows of the sections in order, as ↑ and ↓ walk them. */
export function listRows(list: readonly Section[]): Row[] {
  return list.flatMap((section) => section.rows);
}
