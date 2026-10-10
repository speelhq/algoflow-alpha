// Builders and runners shared by tests. Ids are deterministic (t00000000001 …).
import { toData } from "@/lang/data";
import { dataKind } from "@/lang/kinds";
import type {
  BinOp,
  Data,
  Expr,
  FunctionDef,
  InputDecl,
  NodeId,
  Program,
  Stmt,
  Target,
  Value,
} from "@/lang/types";
import { run } from "@/runtime/run";
import type { Done, Event, State } from "@/runtime/types";

let counter = 0;

export function resetIds(): void {
  counter = 0;
}

export function tid(): NodeId {
  counter += 1;
  return `t${String(counter).padStart(11, "0")}`;
}

export const ast = {
  empty: (): Expr => ({ id: tid(), kind: "empty" }),
  num: (value: number, raw = String(value)): Expr => ({
    id: tid(),
    kind: "num",
    value,
    float: /[.eE]/.test(raw),
    raw,
  }),
  float: (value: number, raw?: string): Expr => ({
    id: tid(),
    kind: "num",
    value,
    float: true,
    raw: raw ?? (Number.isInteger(value) ? `${value}.0` : String(value)),
  }),
  str: (value: string): Expr => ({ id: tid(), kind: "str", value }),
  bool: (value: boolean): Expr => ({ id: tid(), kind: "bool", value }),
  none: (): Expr => ({ id: tid(), kind: "none" }),
  v: (name: string): Expr => ({ id: tid(), kind: "var", name }),
  bin: (op: BinOp, left: Expr, right: Expr): Expr => ({
    id: tid(),
    kind: "binop",
    op,
    left,
    right,
  }),
  neg: (operand: Expr): Expr => ({ id: tid(), kind: "unop", op: "neg", operand }),
  not: (operand: Expr): Expr => ({ id: tid(), kind: "unop", op: "not", operand }),
  list: (...items: Expr[]): Expr => ({ id: tid(), kind: "list", items }),
  call: (fn: string, ...args: Expr[]): Expr => ({ id: tid(), kind: "call", fn, args }),

  assign: (name: string, value: Expr): Stmt => ({
    id: tid(),
    kind: "assign",
    target: { kind: "var", name },
    value,
  }),
  assignTo: (target: Target, value: Expr): Stmt => ({ id: tid(), kind: "assign", target, value }),
  print: (...args: Expr[]): Stmt => ({ id: tid(), kind: "print", args }),
  exprStmt: (expr: Expr): Stmt => ({ id: tid(), kind: "expr", expr }),
  if_: (cond: Expr, then: Stmt[], else_: Stmt[] = []): Stmt => ({
    id: tid(),
    kind: "if",
    cond,
    then,
    else: else_,
  }),
  for_: (variable: string, start: Expr, stop: Expr, body: Stmt[]): Stmt => ({
    id: tid(),
    kind: "for",
    var: variable,
    start,
    stop,
    body,
  }),
  while_: (cond: Expr, body: Stmt[]): Stmt => ({ id: tid(), kind: "while", cond, body }),
  brk: (): Stmt => ({ id: tid(), kind: "break" }),
  cont: (): Stmt => ({ id: tid(), kind: "continue" }),
  ret: (value?: Expr): Stmt =>
    value ? { id: tid(), kind: "return", value } : { id: tid(), kind: "return" },
};

export function program(
  main: Stmt[],
  opts: { inputs?: InputDecl[]; functions?: FunctionDef[]; title?: string } = {},
): Program {
  return {
    version: 1,
    title: opts.title ?? "test",
    inputs: opts.inputs ?? [],
    classes: [],
    functions: opts.functions ?? [],
    main,
  };
}

/** A program of `main` declaring one input per value, of that value's kind, and the values. */
export function withInputs(
  values: Record<string, Data>,
  main: Stmt[],
  opts: { functions?: FunctionDef[] } = {},
): { program: Program; inputs: Record<string, Data> } {
  const inputs = Object.entries(values).map(([name, value]) => ({ name, kind: dataKind(value) }));
  return { program: program(main, { ...opts, inputs }), inputs: values };
}

export type RunResult = {
  events: Event[];
  done: Done;
  stdout: string[];
  state: State;
  draws: number[];
};

/** Runs to completion and returns everything the Runner produced. */
export function runAll(prog: Program, inputs: Record<string, Data> = {}, seed = 1): RunResult {
  const runner = run(prog, inputs, seed);
  const events: Event[] = [];
  for (;;) {
    const next = runner.next();
    if ("type" in next && (next.type === "done" || next.type === "error")) {
      return {
        events,
        done: next,
        stdout: runner.stdout(),
        state: runner.state(),
        draws: runner.draws(),
      };
    }
    events.push(next);
    if (events.length > 10_000_000) throw new Error("runaway test program");
  }
}

/** Main-frame variable as Data (after a completed run). */
export function varData(result: RunResult, name: string): Data {
  const frame = result.state.frames[0];
  const value = frame?.vars.get(name);
  if (!value) throw new Error(`no variable ${name}`);
  return toData(value, result.state.heap);
}

export function varValue(result: RunResult, name: string): Value {
  const value = result.state.frames[0]?.vars.get(name);
  if (!value) throw new Error(`no variable ${name}`);
  return value;
}

/** Evaluates one expression through `result = <expr>` and returns its Data and the expression's events. */
export function evalExpr(
  expr: Expr,
  values: Record<string, Data> = {},
): { data: Data; value: Value; events: Event[]; done: Done } {
  const made = withInputs(values, [ast.assign("result", expr)]);
  const result = runAll(made.program, made.inputs);
  const events = result.events.filter((e) => e.type !== "enter" && e.type !== "write");
  if (result.done.type === "error")
    return { data: null, value: { t: "none" }, events, done: result.done };
  return {
    data: varData(result, "result"),
    value: varValue(result, "result"),
    events,
    done: result.done,
  };
}

export function eventTypes(events: Event[]): string[] {
  return events.map((e) => e.type);
}
