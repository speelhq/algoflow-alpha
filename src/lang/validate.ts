// Every validation code, run after every edit and before every run: scope rules,
// names, empty slots, and field defaults.
// Dispatch is registry-driven: slots, `requires`, `loop`, `params`, `callee`.
import { getNode, hasNode, keyOf } from "@/nodes/registry";
import type { NodeDef, Slot } from "@/nodes/types";
import {
  CLASS_NAME_PATTERN,
  NAME_PATTERN,
  RESERVED,
  type Data,
  type Diagnostic,
  type Expr,
  type Id,
  type NodeId,
  type Program,
  type Stmt,
} from "./types";
import { declaredBy } from "./scope";
import { childSlots, programIds, regionsOf, stmtExprs } from "./walk";

type Bag = Record<string, unknown>;

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && !RESERVED.has(name);
}

export function isValidClassName(name: string): boolean {
  return CLASS_NAME_PATTERN.test(name) && !RESERVED.has(name);
}

/** A builtin call key (`abs`, `random_int`, …) may not be redefined. */
export function isBuiltinName(name: string): boolean {
  return hasNode(`call:${name}`);
}

export function isValidDefault(data: Data): boolean {
  if (data === null || typeof data !== "object") return true;
  if (Array.isArray(data)) return data.length === 0;
  return Object.keys(data).length === 0;
}

type Scope = { loop: number; inFunction: boolean };

class Collector {
  readonly diagnostics: Diagnostic[] = [];
  /** Statements whose var target is the first assignment of that name in its region (`templateCreate`). */
  readonly firstAssigns = new Set<NodeId>();
  /** Functions and classes: names a variable may not shadow (they would call a different thing in CPython). */
  private readonly callables = new Set<Id>();

  constructor(private readonly program: Program) {}

  report(
    nodeId: NodeId,
    code: Diagnostic["code"],
    params: Diagnostic["params"] = {},
    fix?: Diagnostic["fix"],
  ): void {
    this.diagnostics.push(fix ? { nodeId, code, params, fix } : { nodeId, code, params });
  }

  // ------------------------------------------------------------ ids

  ids(): void {
    const seen = new Set<NodeId>();
    for (const id of programIds(this.program)) {
      if (seen.has(id)) this.report(id, "E_DUPLICATE_ID");
      seen.add(id);
    }
  }

  // ------------------------------------------------------------ declarations

  declarations(): void {
    const taken = new Set<Id>(this.program.inputs.map((input) => input.name));
    const claim = (name: Id, nodeId: NodeId) => {
      if (taken.has(name) || isBuiltinName(name)) this.report(nodeId, "E_DUPLICATE_NAME", { name });
      taken.add(name);
      this.callables.add(name);
    };
    for (const fn of this.program.functions) {
      if (!isValidName(fn.name)) this.report(fn.id, "E_BAD_NAME", { name: fn.name });
      const params = new Set<Id>();
      for (const param of fn.params) {
        if (!isValidName(param)) this.report(fn.id, "E_BAD_NAME", { name: param });
        if (params.has(param)) this.report(fn.id, "E_DUPLICATE_NAME", { name: param });
        params.add(param);
      }
      claim(fn.name, fn.id);
    }
    for (const cls of this.program.classes) {
      if (!isValidClassName(cls.name)) this.report(cls.id, "E_BAD_NAME", { name: cls.name });
      claim(cls.name, cls.id);
      const fields = new Set<Id>();
      for (const field of cls.fields) {
        if (!isValidName(field.name)) this.report(cls.id, "E_BAD_NAME", { name: field.name });
        if (fields.has(field.name)) this.report(cls.id, "E_DUPLICATE_NAME", { name: field.name });
        fields.add(field.name);
        if (!isValidDefault(field.default)) this.report(cls.id, "E_DEFAULT", { field: field.name });
      }
    }
  }

  // ------------------------------------------------------------ regions

  scopes(): void {
    for (const fn of this.program.functions) {
      this.region(fn.body, new Set(fn.params), new Map(), { loop: 0, inFunction: true });
    }
    const visible = new Set(this.program.inputs.map((input) => input.name));
    this.region(this.program.main, visible, new Map(), { loop: 0, inFunction: false });
  }

  /**
   * Walks one region. `visible` gains the names assigned directly in it; `inner`
   * maps names first assigned inside an earlier nested frame of this region to
   * that frame's id. Returns every name first assigned anywhere inside
   * the region, so an enclosing region can attribute it to this frame.
   */
  private region(stmts: Stmt[], visible: Set<Id>, inner: Map<Id, NodeId>, scope: Scope): Set<Id> {
    const declared = new Set<Id>();
    for (const stmt of stmts) {
      const def = getNode(keyOf(stmt));
      this.slots(stmt, def);
      this.calls(stmt);
      this.reads(stmt, visible, inner);
      this.control(stmt, def, scope);

      for (const { name, role } of declaredBy(stmt)) {
        if (!isValidName(name)) this.report(stmt.id, "E_BAD_NAME", { name });
        else if (this.callables.has(name) || isBuiltinName(name)) {
          this.report(stmt.id, "E_DUPLICATE_NAME", { name });
        }
        if (!visible.has(name)) {
          declared.add(name);
          if (role === "target") this.firstAssigns.add(stmt.id);
        }
        visible.add(name);
      }

      const bodyScope = def.loop ? { ...scope, loop: scope.loop + 1 } : scope;
      for (const region of regionsOf(stmt)) {
        const nestedDeclared = this.region(
          region.stmts,
          new Set(visible),
          new Map(inner),
          bodyScope,
        );
        for (const name of nestedDeclared) {
          if (visible.has(name)) continue;
          declared.add(name);
          if (!inner.has(name)) inner.set(name, stmt.id);
        }
      }
    }
    return declared;
  }

  private reads(stmt: Stmt, visible: Set<Id>, inner: Map<Id, NodeId>): void {
    for (const expr of stmtExprs(stmt)) {
      if (expr.kind !== "var" || expr.name === "" || visible.has(expr.name)) continue;
      const frame = inner.get(expr.name);
      if (frame === undefined) this.report(stmt.id, "E_UNDEFINED", { name: expr.name });
      else this.report(stmt.id, "E_DECLARE_FIRST", { name: expr.name, frame }, "hoistAssign");
    }
  }

  private control(stmt: Stmt, def: NodeDef, scope: Scope): void {
    if (def.requires === "loop" && scope.loop === 0) this.report(stmt.id, "E_BREAK_OUTSIDE");
    if (def.requires === "function" && !scope.inFunction) this.report(stmt.id, "E_RETURN_OUTSIDE");
  }

  // ------------------------------------------------------------ slots

  private slots(stmt: Stmt, def: NodeDef): void {
    this.requiredSlots(stmt, def, stmt.id);
    const visit = (node: Stmt | Expr) => {
      for (const { slot, expr } of childSlots(node)) {
        if (expr.kind === "empty") {
          this.report(stmt.id, "E_EMPTY_SLOT", { slot });
          continue;
        }
        this.requiredSlots(expr, getNode(keyOf(expr)), stmt.id);
        visit(expr);
      }
    };
    visit(stmt);
  }

  private requiredSlots(node: Stmt | Expr, def: NodeDef, stmtId: NodeId): void {
    const bag = node as unknown as Bag;
    for (const slot of def.slots) {
      if (slot.required && isEmptySlot(slot, bag[slot.name])) {
        this.report(stmtId, "E_EMPTY_SLOT", { slot: slot.name });
      }
    }
  }

  // ------------------------------------------------------------ calls (E_ARITY, E_UNKNOWN_CALL)

  private calls(stmt: Stmt): void {
    for (const expr of stmtExprs(stmt)) {
      const def = getNode(keyOf(expr));
      const callee = def.callee?.(expr);
      if (!callee) continue;
      switch (callee.family) {
        case "builtin":
        case "method":
          this.arity(stmt.id, callee.name, def.params ?? [], callee.argc);
          break;
        case "function": {
          const fn = this.program.functions.find((f) => f.name === callee.name);
          if (!fn) this.report(stmt.id, "E_UNKNOWN_CALL", { name: callee.name });
          else if (fn.params.length !== callee.argc) {
            this.report(stmt.id, "E_ARITY", {
              name: callee.name,
              expected: fn.params.length,
              got: callee.argc,
            });
          }
          break;
        }
        case "class": {
          const cls = this.program.classes.find((c) => c.name === callee.name);
          if (!cls) this.report(stmt.id, "E_UNKNOWN_CALL", { name: callee.name });
          else if (callee.argc > cls.fields.length) {
            this.report(stmt.id, "E_ARITY", {
              name: callee.name,
              expected: cls.fields.length,
              got: callee.argc,
            });
          }
          break;
        }
      }
    }
  }

  /** Optional parameters end with `?`. */
  private arity(stmtId: NodeId, name: Id, params: string[], got: number): void {
    const required = params.filter((p) => !p.endsWith("?")).length;
    if (got < required || got > params.length) {
      this.report(stmtId, "E_ARITY", { name, expected: required, got });
    }
  }
}

function isEmptySlot(slot: Slot, value: unknown): boolean {
  switch (slot.role) {
    case "expr":
      return value === undefined || value === null;
    case "id":
      return typeof value !== "string" || value === "";
    case "text":
      return value === undefined || value === "";
    case "target": {
      const target = value as { kind?: string; name?: string } | undefined;
      return !target || (target.kind === "var" && !target.name);
    }
    case "exprs":
      return !Array.isArray(value) || value.length === 0;
    default:
      return false;
  }
}

type Analysis = { diagnostics: Diagnostic[]; firstAssigns: Set<NodeId> };

// One Collector pass per Program object: the driver, the canvas, and the panels all ask.
// Edits are pure, so a mutated Program is never re-validated; build a new object.
const analyses = new WeakMap<Program, Analysis>();

function analyze(program: Program): Analysis {
  let analysis = analyses.get(program);
  if (!analysis) {
    const collector = new Collector(program);
    collector.ids();
    collector.declarations();
    collector.scopes();
    analysis = { diagnostics: collector.diagnostics, firstAssigns: collector.firstAssigns };
    analyses.set(program, analysis);
  }
  return analysis;
}

export function validate(program: Program): Diagnostic[] {
  return analyze(program).diagnostics;
}

/**
 * Ids of the `assign` statements that create their variable (first assignment in the
 * region): the canvas renders them with `templateCreate`. Inputs, parameters,
 * and loop variables are created elsewhere and never count.
 */
export function firstAssignments(program: Program): Set<NodeId> {
  return analyze(program).firstAssigns;
}
