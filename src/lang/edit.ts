// Pure edit functions. Each returns a new Program and keeps
// every NodeId unique. Statements are addressed by id or by Place.
import { getNode, keyOf } from "@/nodes/registry";
import { newId } from "./id";
import type {
  ClassDef,
  Expr,
  Field,
  FunctionDef,
  Id,
  NodeId,
  Place,
  Program,
  Stmt,
  Target,
} from "./types";
import {
  allExprs,
  isExpr,
  allStmts,
  childSlots,
  idsUnder,
  programIds,
  programStmts,
  regionsOf,
} from "./walk";

type Bag = Record<string, unknown>;

export class EditError extends Error {}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------- ids

/** Gives every node under `stmt` a fresh id (in place). */
function reIdStmt(stmt: Stmt): void {
  stmt.id = newId();
  for (const { expr } of childSlots(stmt)) reIdExpr(expr);
  for (const region of regionsOf(stmt)) for (const child of region.stmts) reIdStmt(child);
}

function reIdExpr(expr: Expr): void {
  expr.id = newId();
  for (const { expr: child } of childSlots(expr)) reIdExpr(child);
}

/** A statement entering the program must not reuse an existing id. */
function fresh(stmt: Stmt, program: Program): Stmt {
  const copy = clone(stmt);
  const existing = new Set(programIds(program));
  if ([...idsUnder([copy])].some((id) => existing.has(id))) reIdStmt(copy);
  return copy;
}

/** An expression entering the program; ids of `replaced`, which it takes the place of, may stay. */
function freshExpr(expr: Expr, program: Program, replaced?: Expr): Expr {
  const copy = clone(expr);
  const existing = new Set(programIds(program));
  if (replaced) for (const e of allExprs(replaced)) existing.delete(e.id);
  if ([...allExprs(copy)].some((e) => existing.has(e.id))) reIdExpr(copy);
  return copy;
}

// ---------------------------------------------------------------- locating

export type Located = { stmt: Stmt; region: Stmt[]; index: number };

function* regions(program: Program): Generator<Stmt[], void, void> {
  yield program.main;
  for (const fn of program.functions) yield fn.body;
  for (const { stmt } of programStmts(program))
    for (const region of regionsOf(stmt)) yield region.stmts;
}

export function locateStmt(program: Program, id: NodeId): Located | undefined {
  for (const region of regions(program)) {
    const index = region.findIndex((stmt) => stmt.id === id);
    const stmt = region[index];
    if (stmt) return { stmt, region, index };
  }
  return undefined;
}

/** The region a place names, or undefined when the program has none there. */
export function findRegion(program: Program, place: Place): Stmt[] | undefined {
  if (place.parent === "main") return program.main;
  const fn = program.functions.find((f) => f.id === place.parent);
  if (fn) return fn.body;
  const located = locateStmt(program, place.parent);
  return located && regionsOf(located.stmt).find((r) => r.slot === place.slot)?.stmts;
}

function regionAt(program: Program, place: Place): Stmt[] {
  const region = findRegion(program, place);
  if (!region) throw new EditError(`no region ${place.slot} of ${place.parent}`);
  return region;
}

/** Finds a statement or expression node by id. */
export function locateNode(program: Program, id: NodeId): Stmt | Expr | undefined {
  for (const { stmt } of programStmts(program)) {
    if (stmt.id === id) return stmt;
    for (const { expr } of childSlots(stmt)) {
      for (const e of allExprs(expr)) if (e.id === id) return e;
    }
  }
  return undefined;
}

function mustLocate(program: Program, id: NodeId): Located {
  const located = locateStmt(program, id);
  if (!located) throw new EditError(`no statement ${id}`);
  return located;
}

// ---------------------------------------------------------------- statements

export function insertStmt(program: Program, stmt: Stmt, place: Place): Program {
  const next = clone(program);
  const region = regionAt(next, place);
  const index = Math.max(0, Math.min(place.index, region.length));
  region.splice(index, 0, fresh(stmt, next));
  return next;
}

export function removeStmt(program: Program, id: NodeId): Program {
  const next = clone(program);
  const { region, index } = mustLocate(next, id);
  region.splice(index, 1);
  return next;
}

/** Moves a statement; `place.index` counts positions in the target region after the removal. */
export function moveStmt(program: Program, id: NodeId, place: Place): Program {
  const next = clone(program);
  const { stmt, region, index } = mustLocate(next, id);
  region.splice(index, 1);
  const target = regionAt(next, place);
  target.splice(Math.max(0, Math.min(place.index, target.length)), 0, stmt);
  return next;
}

export function duplicateStmt(program: Program, id: NodeId): Program {
  const next = clone(program);
  const { stmt, region, index } = mustLocate(next, id);
  const copy = clone(stmt);
  reIdStmt(copy);
  region.splice(index + 1, 0, copy);
  return next;
}

// ---------------------------------------------------------------- slots

/** Sets a non-expression slot (`id`, `text`, or `target`) of a statement or expression. */
export function setSlot(
  program: Program,
  id: NodeId,
  slot: string,
  value: string | Target,
): Program {
  const next = clone(program);
  const node = locateNode(next, id);
  if (!node) throw new EditError(`no node ${id}`);
  const spec = getNode(keyOf(node)).slots.find((s) => s.name === slot);
  if (!spec || spec.role === "expr" || spec.role === "exprs" || spec.role === "body") {
    throw new EditError(`node ${id} has no settable slot ${slot}`);
  }
  (node as unknown as Bag)[slot] = typeof value === "string" ? value : clone(value);
  return next;
}

/**
 * Sets an expression slot. For `exprs` slots `index` selects the item (appending
 * past the end); a target's expression is addressed as `target.<field>`, e.g. `target.index`.
 */
export function setExpr(
  program: Program,
  id: NodeId,
  slot: string,
  expr: Expr,
  index?: number,
): Program {
  const next = clone(program);
  const node = locateNode(next, id);
  if (!node) throw new EditError(`no node ${id}`);
  const [slotName = "", field] = slot.split(".");
  const spec = getNode(keyOf(node)).slots.find((s) => s.name === slotName);
  const bag = node as unknown as Bag;
  const old = (value: unknown) => (isExpr(value) ? value : undefined);
  if (spec?.role === "expr" && field === undefined) {
    bag[slotName] = freshExpr(expr, next, old(bag[slotName]));
  } else if (spec?.role === "exprs" && field === undefined) {
    const items = (bag[slotName] as Expr[] | undefined) ?? [];
    const at = index === undefined ? items.length : Math.max(0, Math.min(index, items.length));
    items.splice(at, at < items.length ? 1 : 0, freshExpr(expr, next, old(items[at])));
    bag[slotName] = items;
  } else if (spec?.role === "target" && field !== undefined) {
    const target = bag[slotName] as Bag | undefined;
    if (!target || target.kind === "var" || !(field in target)) {
      throw new EditError(`target of ${id} has no expression field ${field}`);
    }
    target[field] = freshExpr(expr, next, old(target[field]));
  } else {
    throw new EditError(`node ${id} has no expression slot ${slot}`);
  }
  return next;
}

/** Removes item `index` of an `exprs` slot. */
export function removeItem(program: Program, id: NodeId, slot: string, index: number): Program {
  const next = clone(program);
  const node = locateNode(next, id);
  if (!node) throw new EditError(`no node ${id}`);
  const spec = getNode(keyOf(node)).slots.find((s) => s.name === slot);
  const items = (node as unknown as Bag)[slot];
  if (spec?.role !== "exprs" || !Array.isArray(items) || index < 0 || index >= items.length) {
    throw new EditError(`node ${id} has no item ${index} in ${slot}`);
  }
  items.splice(index, 1);
  return next;
}

// ---------------------------------------------------------------- names

/** A node's name as stored: each run of spaces and line breaks one space, trimmed. */
export function stmtName(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Names statement `id`, or removes its name when `name` holds no text. */
export function setStmtName(program: Program, id: NodeId, name: string): Program {
  const next = clone(program);
  const { stmt } = mustLocate(next, id);
  const stored = stmtName(name);
  if (stored === "") delete stmt.name;
  else stmt.name = stored;
  return next;
}

/** Renames a variable, function, or class everywhere it occurs (`id` slots, targets, declarations). */
export function renameName(program: Program, from: Id, to: Id): Program {
  const next = clone(program);
  const swap = (name: string) => (name === from ? to : name);
  for (const input of next.inputs) input.name = swap(input.name);
  for (const fn of next.functions) {
    fn.name = swap(fn.name);
    fn.params = fn.params.map(swap);
  }
  for (const cls of next.classes) cls.name = swap(cls.name);
  const renameIdSlots = (node: Stmt | Expr) => {
    const bag = node as unknown as Bag;
    for (const slot of getNode(keyOf(node)).slots) {
      if (slot.role === "id" && typeof bag[slot.name] === "string") {
        bag[slot.name] = swap(bag[slot.name] as string);
      } else if (slot.role === "target") {
        const target = bag[slot.name] as Target | undefined;
        if (target?.kind === "var") target.name = swap(target.name);
      }
    }
  };
  for (const { stmt } of programStmts(next)) {
    renameIdSlots(stmt);
    for (const { expr: root } of childSlots(stmt))
      for (const expr of allExprs(root)) renameIdSlots(expr);
  }
  return next;
}

// ---------------------------------------------------------------- functions and classes

export function addFunction(program: Program, name: Id, params: Id[] = []): Program {
  const next = clone(program);
  const fn: FunctionDef = { id: newId(), name, params: [...params], body: [] };
  next.functions.push(fn);
  return next;
}

export function removeFunction(program: Program, id: NodeId): Program {
  const next = clone(program);
  const index = next.functions.findIndex((fn) => fn.id === id);
  if (index < 0) throw new EditError(`no function ${id}`);
  next.functions.splice(index, 1);
  return next;
}

export function addClass(program: Program, name: Id): Program {
  const next = clone(program);
  const cls: ClassDef = { id: newId(), name, fields: [] };
  next.classes.push(cls);
  return next;
}

export function removeClass(program: Program, id: NodeId): Program {
  const next = clone(program);
  const index = next.classes.findIndex((cls) => cls.id === id);
  if (index < 0) throw new EditError(`no class ${id}`);
  next.classes.splice(index, 1);
  return next;
}

/** Replaces the ordered parameters of a function. */
export function setParams(program: Program, id: NodeId, params: Id[]): Program {
  const next = clone(program);
  const fn = next.functions.find((f) => f.id === id);
  if (!fn) throw new EditError(`no function ${id}`);
  fn.params = [...params];
  return next;
}

/** Replaces the ordered field table of a class. */
export function setFields(program: Program, id: NodeId, fields: Field[]): Program {
  const next = clone(program);
  const cls = next.classes.find((c) => c.id === id);
  if (!cls) throw new EditError(`no class ${id}`);
  cls.fields = clone(fields);
  return next;
}

// ---------------------------------------------------------------- the E_DECLARE_FIRST fix

/** The zero-like literal of the first value assigned to `name` inside `stmts`, else None. */
function defaultFor(stmts: Stmt[], name: Id): Expr {
  for (const stmt of allStmts(stmts)) {
    const def = getNode(keyOf(stmt));
    const bag = stmt as unknown as Bag;
    const assignsName = def.slots.some((slot) => {
      if (slot.role !== "target") return false;
      const target = bag[slot.name] as Target | undefined;
      return target?.kind === "var" && target.name === name;
    });
    if (!assignsName) continue;
    const valueSlot = def.slots.find((slot) => slot.role === "expr");
    const value = valueSlot ? (bag[valueSlot.name] as Expr | undefined) : undefined;
    const zero = value ? getNode(keyOf(value)).zeroLike?.(value) : undefined;
    return zero ?? { id: newId(), kind: "none" };
  }
  return { id: newId(), kind: "none" };
}

/** Inserts `name = <default>` immediately before the frame `frameId`. */
export function hoistAssign(program: Program, frameId: NodeId, name: Id): Program {
  const next = clone(program);
  const { stmt, region, index } = mustLocate(next, frameId);
  const inner = regionsOf(stmt).flatMap((r) => r.stmts);
  const assign: Stmt = {
    id: newId(),
    kind: "assign",
    target: { kind: "var", name },
    value: defaultFor(inner, name),
  };
  region.splice(index, 0, assign);
  return next;
}
