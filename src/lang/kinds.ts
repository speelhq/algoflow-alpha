// What the value list and the name list know of a value before the program runs: an
// expression's kind from its block's `kind`, and a variable's from its input, else the value
// of its first assignment, else the kind its loop block declares. Registry-driven.
import { getNode, keyOf } from "@/nodes/registry";
import { declaredBy } from "./scope";
import type { Data, Expr, Id, Kind, NodeId, Program, Stmt } from "./types";
import { allStmts, childSlots, variableOf } from "./walk";

/** The kind of an input's or a default's value. */
export function dataKind(data: Data): Kind {
  if (typeof data === "number") return "number";
  if (typeof data === "string") return "text";
  if (typeof data === "boolean") return "truefalse";
  if (data === null) return "none";
  if (Array.isArray(data)) return "list";
  if ("$float" in data) return "number";
  return "$cls" in data ? "object" : "dict";
}

export type Kinds = ReadonlyMap<Id, Kind>;

/** The kind of `expr`, its variables' kinds being `variables`; undefined when it cannot be told. */
export function exprKind(expr: Expr, variables: Kinds): Kind | undefined {
  const name = variableOf(expr);
  if (name !== undefined) return variables.get(name);
  return getNode(keyOf(expr)).kind?.(expr, (inner) => exprKind(inner, variables));
}

/** `main`, or the function whose body holds statement `id`. */
export function chartOf(program: Program, id: NodeId): "main" | NodeId {
  for (const fn of program.functions) {
    for (const stmt of allStmts(fn.body)) if (stmt.id === id) return fn.id;
  }
  return "main";
}

type Scope = { kinds: Map<Id, Kind>; setters: Map<Id, Stmt> };

const memo = new WeakMap<Program, Map<string, Scope>>();

function scope(program: Program, chart: "main" | NodeId): Scope {
  let charts = memo.get(program);
  if (!charts) {
    charts = new Map();
    memo.set(program, charts);
  }
  const known = charts.get(chart);
  if (known) return known;
  const fn = program.functions.find((candidate) => candidate.id === chart);
  const kinds = new Map<Id, Kind>();
  const setters = new Map<Id, Stmt>();
  const assigned = new Set<Id>();
  if (!fn) {
    for (const input of program.inputs) {
      kinds.set(input.name, dataKind(input.value));
      assigned.add(input.name);
    }
  }
  for (const stmt of allStmts(fn ? fn.body : program.main)) {
    const def = getNode(keyOf(stmt));
    for (const { name, role } of declaredBy(stmt)) {
      if (!setters.has(name)) setters.set(name, stmt);
      if (role === "id") {
        // A loop's kind holds until an assignment says otherwise.
        if (!assigned.has(name) && !kinds.has(name) && def.declares) kinds.set(name, def.declares);
        continue;
      }
      if (assigned.has(name)) continue;
      assigned.add(name);
      const slot = def.slots.find((candidate) => candidate.role === "expr")?.name;
      const value = childSlots(stmt).find((child) => child.slot === slot)?.expr;
      const kind = value ? exprKind(value, kinds) : undefined;
      if (kind) kinds.set(name, kind);
    }
  }
  const made = { kinds, setters };
  charts.set(chart, made);
  return made;
}

/** The kinds of the variables of `main` or of one function, by its id. */
export function variableKinds(program: Program, chart: "main" | NodeId): Kinds {
  return scope(program, chart).kinds;
}

/** The statement that first sets each variable of `main` or of one function. */
export function firstSetters(program: Program, chart: "main" | NodeId): ReadonlyMap<Id, Stmt> {
  return scope(program, chart).setters;
}
