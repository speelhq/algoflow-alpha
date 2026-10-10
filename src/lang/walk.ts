// Traversal driven by each block's slots, so no module lists block kinds.
import { getNode, keyOf } from "@/nodes/registry";
import type { Expr, FunctionDef, Node, NodeId, Program, Stmt, Target } from "./types";

type Bag = Record<string, unknown>;

export function targetExprs(target: Target): Expr[] {
  switch (target.kind) {
    case "var":
      return [];
    case "index":
      return [target.list, target.index];
    case "key":
      return [target.dict, target.key];
    case "field":
      return [target.obj];
  }
}

export function isExpr(value: unknown): value is Expr {
  return typeof value === "object" && value !== null && "kind" in value && "id" in value;
}

/** An unfilled slot: the one expression that is no block a learner chooses. */
export function isEmptyExpr(value: unknown): boolean {
  return isExpr(value) && value.kind === "empty";
}

/**
 * The name an expression reads, when it is a variable: the block whose one slot is a name.
 * Read from the block's slots, so no module names the variable block.
 */
export function variableOf(expr: Expr): string | undefined {
  const { slots } = getNode(keyOf(expr));
  const [slot] = slots;
  if (slots.length !== 1 || slot?.role !== "id") return undefined;
  const name = (expr as unknown as Bag)[slot.name];
  return typeof name === "string" ? name : undefined;
}

export type SlotExpr = { slot: string; expr: Expr; index?: number };

/** Direct expression children with the slot each sits in (target children under the target slot). */
export function childSlots(node: Node): SlotExpr[] {
  const def = getNode(keyOf(node));
  const bag = node as unknown as Bag;
  const out: SlotExpr[] = [];
  for (const slot of def.slots) {
    const value = bag[slot.name];
    if (slot.role === "expr" && isExpr(value)) out.push({ slot: slot.name, expr: value });
    else if (slot.role === "exprs" && Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isExpr(item)) out.push({ slot: slot.name, expr: item, index });
      });
    } else if (slot.role === "target" && value && typeof value === "object") {
      for (const expr of targetExprs(value as Target)) out.push({ slot: slot.name, expr });
    }
  }
  return out;
}

/** Direct expression children of a statement or expression, in slot order. */
export function childExprs(node: Node): Expr[] {
  return childSlots(node).map((entry) => entry.expr);
}

/** Body regions of a statement, in slot order (empty for simple statements). */
export function regionsOf(stmt: Stmt): Array<{ slot: string; stmts: Stmt[] }> {
  const def = getNode(keyOf(stmt));
  const bag = stmt as unknown as Bag;
  const out: Array<{ slot: string; stmts: Stmt[] }> = [];
  for (const slot of def.slots) {
    const value = bag[slot.name];
    if (slot.role === "body" && Array.isArray(value)) {
      out.push({ slot: slot.name, stmts: value as Stmt[] });
    }
  }
  return out;
}

/** Every statement under `stmts`, pre-order. */
export function* allStmts(stmts: Stmt[]): Generator<Stmt, void, void> {
  for (const stmt of stmts) {
    yield stmt;
    for (const region of regionsOf(stmt)) yield* allStmts(region.stmts);
  }
}

/** `expr` and every expression under it, pre-order. */
export function* allExprs(expr: Expr): Generator<Expr, void, void> {
  yield expr;
  for (const child of childExprs(expr)) yield* allExprs(child);
}

/** Every expression of a statement (not its regions). */
export function* stmtExprs(stmt: Stmt): Generator<Expr, void, void> {
  for (const child of childExprs(stmt)) yield* allExprs(child);
}

/** Every NodeId under `stmts`: statements and their expressions, pre-order. */
export function* idsUnder(stmts: Stmt[]): Generator<NodeId, void, void> {
  for (const stmt of allStmts(stmts)) {
    yield stmt.id;
    for (const expr of stmtExprs(stmt)) yield expr.id;
  }
}

export type StmtSite = { stmt: Stmt; fn: FunctionDef | null };

/** Every statement in the program with the function it belongs to (null for main). */
export function* programStmts(program: Program): Generator<StmtSite, void, void> {
  for (const fn of program.functions) for (const stmt of allStmts(fn.body)) yield { stmt, fn };
  for (const stmt of allStmts(program.main)) yield { stmt, fn: null };
}

export function* programExprs(program: Program): Generator<Expr, void, void> {
  for (const { stmt } of programStmts(program)) yield* stmtExprs(stmt);
}

/**
 * The statement that contains each node. Expressions map to their statement,
 * statements, functions, and classes to themselves.
 */
export function ownerStmts(program: Program): Map<NodeId, NodeId> {
  const owners = new Map<NodeId, NodeId>();
  for (const cls of program.classes) owners.set(cls.id, cls.id);
  for (const fn of program.functions) owners.set(fn.id, fn.id);
  for (const { stmt } of programStmts(program)) {
    owners.set(stmt.id, stmt.id);
    for (const expr of stmtExprs(stmt)) owners.set(expr.id, stmt.id);
  }
  return owners;
}

/**
 * For each statement with body regions, the ids of every statement inside them,
 * at any depth. A loop's `loop` event clears the marks of these statements.
 */
export function bodyStmts(program: Program): Map<NodeId, NodeId[]> {
  const bodies = new Map<NodeId, NodeId[]>();
  for (const { stmt } of programStmts(program)) {
    const regions = regionsOf(stmt);
    if (regions.length === 0) continue;
    const ids: NodeId[] = [];
    for (const region of regions) for (const inner of allStmts(region.stmts)) ids.push(inner.id);
    bodies.set(stmt.id, ids);
  }
  return bodies;
}

const indexes = new WeakMap<Program, Map<NodeId, Node>>();

/** Every statement and expression of the program by id; one pass per Program object. */
export function nodesById(program: Program): Map<NodeId, Node> {
  let index = indexes.get(program);
  if (!index) {
    index = new Map();
    for (const { stmt } of programStmts(program)) {
      index.set(stmt.id, stmt);
      for (const expr of stmtExprs(stmt)) index.set(expr.id, expr);
    }
    indexes.set(program, index);
  }
  return index;
}

/** Every NodeId in the program: classes, functions, statements, expressions. */
export function* programIds(program: Program): Generator<NodeId, void, void> {
  for (const cls of program.classes) yield cls.id;
  for (const fn of program.functions) {
    yield fn.id;
    yield* idsUnder(fn.body);
  }
  yield* idsUnder(program.main);
}
