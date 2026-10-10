// The entries of the value list as the blocks declare them: each with its block, its
// label and help, and how it makes its expression. Reads `menu` and `create()`, never a kind.
import type { Expr } from "@/lang/types";
import { NODES, getNode, keyOf, type NodeDef } from "@/nodes/registry";
import type { MenuEntry, MenuGroup } from "@/nodes/types";
import { nodeText } from "@/i18n/t";

export type Entry = {
  /** `<key>` or `<key>.<name>`. */
  id: string;
  def: NodeDef;
  menu: MenuEntry;
  label: string;
  help: string;
};

const base = (def: NodeDef, menu: MenuEntry) =>
  menu.name === "" ? def.key : `${def.key}.${menu.name}`;

let cached: Entry[] | undefined;

/** Every entry of the registered blocks, in registry order (the order of the value list). */
export function allEntries(): Entry[] {
  cached ??= [...NODES.values()].flatMap((def) =>
    (def.menu ?? []).map((menu) => ({
      id: base(def, menu),
      def,
      menu,
      label: nodeText(base(def, menu), "label"),
      help: nodeText(base(def, menu), "help"),
    })),
  );
  return cached;
}

/** Whether the entry is offered after a value, which it takes as its first input. */
export function takesValue(entry: Entry): boolean {
  return entry.menu.on !== undefined;
}

/** The entry's expression: its block's `create()` with the entry's preset. */
export function makeEntry(entry: Entry): Expr {
  return { ...(entry.def.create() as Expr), ...entry.menu.preset } as Expr;
}

/** The entry an expression was made from: its block's entry whose preset it holds. */
export function entryOf(expr: Expr): Entry | undefined {
  const bag = expr as unknown as Record<string, unknown>;
  const key = keyOf(expr);
  return allEntries().find(
    (entry) =>
      entry.def.key === key &&
      Object.entries(entry.menu.preset ?? {}).every(([slot, value]) => bag[slot] === value),
  );
}

/** The label of what an expression is: its entry's, else its block's. */
export function labelOf(expr: Expr): string {
  return entryOf(expr)?.label ?? nodeText(getNode(keyOf(expr)).key, "label");
}

export const GROUPS: readonly MenuGroup[] = [
  "values",
  "conditions",
  "calculate",
  "items",
  "compare",
  "convert",
];
