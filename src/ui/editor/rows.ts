// The lists under the editor's fields: the value list of the focused value line (or, while an
// operator is switched, the other operators of its group), and the name list of a name field.
import { t } from "@/i18n/t";
import type { Kinds } from "@/lang/kinds";
import type { Id, Program } from "@/lang/types";
import type { ListItem, ListSection } from "./EditorList";
import { allEntries, entryOf } from "./entries";
import { functionLabel } from "./explain";
import { find, type LineContext, type Row } from "./line";
import { listRows, listSections } from "./list";
import { nameSections, type NameRow } from "./names";
import type { Session } from "./session";

/** A variable's kind as the lists name it. */
function kindName(kinds: Kinds, name: Id): string | undefined {
  const kind = kinds.get(name);
  return kind ? t(`editor.kind.${kind}`) : undefined;
}

function rowItem(row: Row, index: number, kinds: Kinds): ListItem {
  switch (row.kind) {
    case "variable":
      return {
        key: `v:${row.name}:${index}`,
        label: row.name,
        variable: true,
        note: kindName(kinds, row.name),
      };
    case "entry":
      return {
        key: `e:${row.entry.id}`,
        label: row.entry.label,
        ...(row.entry.menu.symbol ? { symbol: row.entry.menu.symbol } : {}),
      };
    case "function":
      return { key: `f:${row.fn.name}`, label: functionLabel(row.fn) };
    case "brackets":
      return { key: "brackets", label: t("editor.brackets"), symbol: t("editor.bracketsGlyph") };
  }
}

/** The other operators of the switched operator's block and group. */
function switchRows(session: Session, kinds: Kinds): { rows: Row[]; sections: ListSection[] } {
  const { line, switching } = session;
  const held = line && switching ? find(line.root, switching) : undefined;
  const current = held ? entryOf(held) : undefined;
  if (!current) return { rows: [], sections: [] };
  const rows = allEntries()
    .filter(
      (entry) =>
        entry !== current && entry.def === current.def && entry.menu.group === current.menu.group,
    )
    .map((entry): Row => ({ kind: "entry", entry }));
  const title = t(`editor.lists.${current.menu.group}`);
  const items = rows.map((row, index) => rowItem(row, index, kinds));
  return { rows, sections: rows.length > 0 ? [{ title, items }] : [] };
}

/** The rows of the focused value line's list, and its sections as drawn. */
export function valueList(
  session: Session,
  ctx: LineContext,
): { rows: Row[]; sections: ListSection[] } {
  const { line } = session;
  if (!line) return { rows: [], sections: [] };
  if (session.switching) return switchRows(session, ctx.kinds);
  const listed = listSections(line, ctx, session.all);
  let index = 0;
  const sections = listed.map((section) => ({
    title: t(`editor.lists.${section.group}`),
    items: section.rows.map((row) => rowItem(row, (index += 1), ctx.kinds)),
  }));
  return { rows: listRows(listed), sections };
}

/** The rows of a name field's list for the name typed, and its sections as drawn. */
export function nameList(
  program: Program,
  asked: readonly Id[],
  typed: string | null,
  kinds: Kinds,
): { rows: NameRow[]; sections: ListSection[] } {
  const listed = nameSections(program, asked, typed ?? "");
  const sections = listed.map((section) => ({
    title:
      section.group === "problem"
        ? t("editor.thisProblem")
        : section.group === "variables"
          ? t("editor.lists.variables")
          : "",
    items: section.rows.map((row) => ({
      key: `${row.kind}:${row.name}`,
      label: row.name,
      variable: true,
      ...(row.kind === "new"
        ? { lead: t("editor.newVariable") }
        : { note: kindName(kinds, row.name) }),
    })),
  }));
  return { rows: listed.flatMap((section) => section.rows), sections };
}

/** The name row highlighted: the one moved to, else while a name is typed the whole name or the first. */
export function shownNameRow(session: Session, rows: readonly NameRow[]): number | null {
  const { highlight, typed } = session;
  if (highlight !== null && highlight < rows.length) return highlight;
  if (!typed) return null;
  const whole = rows.findIndex((row) => row.kind === "name" && row.name === typed);
  return whole >= 0 ? whole : rows.length > 0 ? 0 : null;
}
