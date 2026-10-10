// What the editor asks of a program's structure: the names visible at a statement,
// whether a place lies inside a loop or a function, and where an expression sits.
// Registry-driven: slots, `loop`, and regions, never a kind.
import { getNode, keyOf } from "@/nodes/registry";
import type { Id, Node, NodeId, Place, Program, Stmt, Target } from "./types";
import { childSlots, regionsOf } from "./walk";

type Bag = Record<string, unknown>;

export type Declared = { name: Id; role: "id" | "target" };

/** Names a statement assigns in its own region: its variable targets and its loop variables. */
export function declaredBy(stmt: Stmt): Declared[] {
  const bag = stmt as unknown as Bag;
  const names: Declared[] = [];
  for (const slot of getNode(keyOf(stmt)).slots) {
    const value = bag[slot.name];
    if (slot.role === "id" && typeof value === "string" && value !== "") {
      names.push({ name: value, role: "id" });
    }
    if (slot.role === "target" && value && typeof value === "object") {
      const target = value as Target;
      if (target.kind === "var" && target.name !== "") {
        names.push({ name: target.name, role: "target" });
      }
    }
  }
  return names;
}

/** `names` with `latest` moved to the front, in their order. */
function bump(names: Id[], latest: Id[]): Id[] {
  return [...latest, ...names.filter((name) => !latest.includes(name))];
}

/**
 * The names visible to the slots of statement `id`, the most recently assigned first:
 * what was assigned before it in its region and the regions around it, the loop variables
 * of the loops around it, and the inputs or parameters. Undefined for an unknown id.
 */
export function visibleAt(program: Program, id: NodeId): Id[] | undefined {
  const walk = (stmts: Stmt[], visible: Id[]): Id[] | undefined => {
    let names = visible;
    for (const stmt of stmts) {
      if (stmt.id === id) return names;
      const own = declaredBy(stmt).map((declared) => declared.name);
      for (const region of regionsOf(stmt)) {
        const found = walk(region.stmts, bump(names, own));
        if (found) return found;
      }
      names = bump(names, own);
    }
    return undefined;
  };
  for (const fn of program.functions) {
    const found = walk(fn.body, fn.params.toReversed());
    if (found) return found;
  }
  return walk(program.main, program.inputs.map((input) => input.name).toReversed());
}

/** The statement whose region holds each statement; a top-level statement maps to its chart. */
function parents(program: Program): Map<NodeId, NodeId | "main"> {
  const map = new Map<NodeId, NodeId | "main">();
  const walk = (stmts: Stmt[], parent: NodeId | "main") => {
    for (const stmt of stmts) {
      map.set(stmt.id, parent);
      for (const region of regionsOf(stmt)) walk(region.stmts, stmt.id);
    }
  };
  walk(program.main, "main");
  for (const fn of program.functions) walk(fn.body, fn.id);
  return map;
}

/** Whether a statement at `place` would be inside a loop body and inside a function. */
export function placeContext(program: Program, place: Place): { loop: boolean; fn: boolean } {
  const up = parents(program);
  const functions = new Set(program.functions.map((fn) => fn.id));
  const stmts = new Map<NodeId, Stmt>();
  const index = (list: Stmt[]) => {
    for (const stmt of list) {
      stmts.set(stmt.id, stmt);
      for (const region of regionsOf(stmt)) index(region.stmts);
    }
  };
  index(program.main);
  for (const fn of program.functions) index(fn.body);

  let loop = false;
  let at: NodeId | "main" | undefined = place.parent;
  while (at !== undefined && at !== "main" && !functions.has(at)) {
    const stmt = stmts.get(at);
    if (stmt && getNode(keyOf(stmt)).loop) loop = true;
    at = up.get(at);
  }
  return { loop, fn: at !== undefined && at !== "main" };
}

/** Where an expression sits: the node holding it, its slot (`target.<field>` in a target), its item. */
export type ExprSite = { owner: NodeId; slot: string; index?: number };

/** The site of expression `id` within the statements of the program, if it is there. */
export function siteOf(program: Program, id: NodeId): ExprSite | undefined {
  const search = (node: Node): ExprSite | undefined => {
    for (const child of childSlots(node)) {
      if (child.expr.id === id) {
        const slot = getNode(keyOf(node)).slots.find((s) => s.name === child.slot);
        if (slot?.role !== "target") {
          return child.index === undefined
            ? { owner: node.id, slot: child.slot }
            : { owner: node.id, slot: child.slot, index: child.index };
        }
        const target = (node as unknown as Bag)[child.slot] as Bag;
        const field = Object.keys(target).find((key) => target[key] === child.expr);
        return { owner: node.id, slot: `${child.slot}.${field ?? ""}` };
      }
      const found = search(child.expr);
      if (found) return found;
    }
    return undefined;
  };
  const walk = (stmts: Stmt[]): ExprSite | undefined => {
    for (const stmt of stmts) {
      const found =
        search(stmt) ??
        regionsOf(stmt).reduce<ExprSite | undefined>(
          (hit, region) => hit ?? walk(region.stmts),
          undefined,
        );
      if (found) return found;
    }
    return undefined;
  };
  for (const fn of program.functions) {
    const found = walk(fn.body);
    if (found) return found;
  }
  return walk(program.main);
}
