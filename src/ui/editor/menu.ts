// The block menu's entries for one connector: the registered statement blocks
// grouped by category in menu order, each in registration order, those whose `requires`
// the place does not meet disabled with the reason, then the program's own functions as
// calls. Reads `shape`, `hidden`, `category`, and `requires`, never a kind.
import { fillPlaceholders, t, type MessageKey } from "@/i18n/t";
import { newId } from "@/lang/id";
import { placeContext } from "@/lang/scope";
import type { Expr, Place, Program, Stmt } from "@/lang/types";
import { getNode, paletteNodes, type NodeDef } from "@/nodes/registry";
import { CATEGORIES, type Category } from "@/nodes/categories";
import { blankTemplate, nodeText } from "@/ui/chart/text";

export type MenuEntry = {
  /** The registry key, or `call:<name>` for a function of the program. */
  id: string;
  /** The block's template with every slot written `…`. */
  text: string;
  label: string;
  help: string;
  /** Why the block cannot go here; absent when it can. */
  disabled?: string;
  create: () => Stmt;
};
export type MenuGroup = { id: Category | "program"; title: string; entries: MenuEntry[] };

/** An entry's text: the template with its `text` slots as the block's label, the rest blank. */
function entryText(def: NodeDef): string {
  const label = nodeText(def.key, "label");
  return fillPlaceholders(nodeText(def.key, "template"), (name) =>
    def.slots.find((slot) => slot.name === name)?.role === "text"
      ? label.charAt(0).toLowerCase() + label.slice(1)
      : t("chart.blank"),
  );
}

/** The groups of the block menu at `place`; empty groups are left out. */
export function menuGroups(program: Program, place: Place): MenuGroup[] {
  const here = placeContext(program, place);
  const groups: MenuGroup[] = [];
  for (const category of CATEGORIES) {
    const entries = paletteNodes(category)
      .filter((def) => def.shape === "stmt")
      .map((def): MenuEntry => {
        const missing =
          (def.requires === "loop" && !here.loop) || (def.requires === "function" && !here.fn);
        const entry: MenuEntry = {
          id: def.key,
          text: entryText(def),
          label: nodeText(def.key, "label"),
          help: nodeText(def.key, "help"),
          create: () => def.create() as Stmt,
        };
        if (missing && def.requires) entry.disabled = t(`menu.requires.${def.requires}`);
        return entry;
      });
    if (entries.length > 0) {
      groups.push({ id: category, title: t(`menu.category.${category}` as MessageKey), entries });
    }
  }
  const calls = program.functions.map((fn): MenuEntry => {
    const text = t("node.call.template", {
      fn: fn.name,
      args: fn.params.length > 0 ? blankTemplate("{a}") : "",
    });
    return {
      id: `call:${fn.name}`,
      text,
      label: fn.name,
      help: nodeText("call", "help"),
      create: () => callStatement(fn.name, fn.params.length),
    };
  });
  if (calls.length > 0) groups.push({ id: "program", title: t("menu.program"), entries: calls });
  return groups;
}

/** A statement calling `name` with `argc` empty arguments, as the call block creates it. */
function callStatement(name: string, argc: number): Stmt {
  const statement = getNode("expr").create() as Extract<Stmt, { kind: "expr" }>;
  const call = getNode("call").create() as Extract<Expr, { kind: "call" }>;
  const args: Expr[] = Array.from({ length: argc }, () => ({ id: newId(), kind: "empty" }));
  return { ...statement, expr: { ...call, fn: name, args } };
}

/** The groups with only the entries whose label or help contains `query`. */
export function searchMenu(groups: MenuGroup[], query: string): MenuGroup[] {
  const q = query.trim().toLowerCase();
  if (q === "") return groups;
  return groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) =>
        [entry.label, entry.help].some((text) => text.toLowerCase().includes(q)),
      ),
    }))
    .filter((group) => group.entries.length > 0);
}
