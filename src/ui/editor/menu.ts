// The block menu's entries for one connector: the registered statement blocks
// grouped by category in menu order, each in registration order, those whose `requires`
// the place does not meet disabled with the reason, then the program's functions a call can
// name, as calls. Reads `shape`, `hidden`, `category`, and `requires`, never a kind.
import { nodeText, t } from "@/i18n/t";
import { placeContext } from "@/lang/scope";
import type { Place, Program, Stmt } from "@/lang/types";
import { getNode, menuBlocks } from "@/nodes/registry";
import { CATEGORIES, type Category } from "@/nodes/categories";
import { parseScope } from "@/python/parse";
import { blankTemplate } from "@/ui/chart/text";
import { callableFunctions, callExpr, type LineFunction } from "./line";

export type BlockMenuEntry = {
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
export type BlockMenuGroup = { id: Category | "program"; title: string; entries: BlockMenuEntry[] };

/** The groups of the block menu at `place`; empty groups are left out. */
export function menuGroups(program: Program, place: Place): BlockMenuGroup[] {
  const here = placeContext(program, place);
  const groups: BlockMenuGroup[] = [];
  for (const category of CATEGORIES) {
    const entries = menuBlocks(category)
      .filter((def) => def.shape === "stmt")
      .map((def): BlockMenuEntry => {
        const missing =
          (def.requires === "loop" && !here.loop) || (def.requires === "function" && !here.fn);
        const entry: BlockMenuEntry = {
          id: def.key,
          text: blankTemplate(nodeText(def.key, "template")),
          label: nodeText(def.key, "label"),
          help: nodeText(def.key, "help"),
          create: () => def.create() as Stmt,
        };
        if (missing && def.requires) entry.disabled = t(`menu.requires.${def.requires}`);
        return entry;
      });
    if (entries.length > 0) {
      groups.push({ id: category, title: t(`menu.category.${category}`), entries });
    }
  }
  const calls = callableFunctions(program).map((fn): BlockMenuEntry => {
    const text = t("node.call.template", {
      fn: fn.name,
      args: fn.params.length > 0 ? blankTemplate("{a}") : "",
    });
    return {
      id: `call:${fn.name}`,
      text,
      label: fn.name,
      help: nodeText("call", "help"),
      create: () => callStatement(program, fn),
    };
  });
  if (calls.length > 0) groups.push({ id: "program", title: t("menu.program"), entries: calls });
  return groups;
}

/** A statement calling `fn` of `program`, its arguments to fill, as a value line makes the call. */
function callStatement(program: Program, fn: LineFunction): Stmt {
  const call = callExpr(fn, parseScope(program));
  if (!call) throw new Error(`"${fn.name}" is no function of the program`);
  const statement = getNode("expr").create() as Extract<Stmt, { kind: "expr" }>;
  return { ...statement, expr: call };
}

/** The groups with only the entries whose label or help contains `query`. */
export function searchMenu(groups: BlockMenuGroup[], query: string): BlockMenuGroup[] {
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
