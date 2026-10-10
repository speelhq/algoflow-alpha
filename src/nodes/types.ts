// NodeDef plus the runner and emitter contracts blocks implement.
import type {
  Expr,
  ExprKind,
  Heap,
  Id,
  Kind,
  NodeId,
  Program,
  Stmt,
  StmtKind,
  Target,
  Value,
} from "@/lang/types";
import type { Event, RuntimeCode } from "@/runtime/types";
import type { Category } from "./categories";

export type SlotRole = "expr" | "exprs" | "id" | "body" | "target" | "text";

/** What a call-like expression invokes; `builtin` and `method` arity comes from `params`. */
export type Callee = {
  name: Id;
  argc: number;
  family: "builtin" | "function" | "class" | "method";
};
export type Slot = {
  name: string;
  role: SlotRole;
  required?: boolean;
};

/** The groups of the value list, in its order. */
export type MenuGroup = "values" | "conditions" | "calculate" | "items" | "compare" | "convert";

/** One entry of the value list. */
export type MenuEntry = {
  /** `""` for the block's own label and help, else `node.<key>.<name>.label` / `.help`. */
  name: string;
  group: MenuGroup;
  /** Offered after a value of these kinds, which it takes as its first input. */
  on?: readonly Kind[];
  /** Slot values set on the block's `create()` (binop `op`). */
  preset?: Record<string, unknown>;
  /** Shown before the name in the list (`×`). */
  symbol?: string;
  /** What typed in a value line inserts it. */
  keys?: string;
};

// ---------------------------------------------------------------- runner

export type Signal =
  | undefined
  | { kind: "break" }
  | { kind: "continue" }
  | { kind: "return"; value: Value };

export type RunContext = {
  program: Program;
  heap: Heap;
  eval(expr: Expr): Generator<Event, Value, void>;
  exec(body: Stmt[]): Generator<Event, Signal, void>;
  get(name: Id, nodeId: NodeId): Value;
  set(name: Id, value: Value): void;
  call(fn: Id, args: Value[], nodeId: NodeId): Generator<Event, Value, void>;
  fail(nodeId: NodeId, code: RuntimeCode, params?: Record<string, string | number>): never;
  random: { int(a: number, b: number): number; float(a: number, b: number): number };
  print(line: string): void;
};

export type StmtRunner = (node: Stmt, ctx: RunContext) => Generator<Event, Signal, void>;
export type ExprRunner = (node: Expr, ctx: RunContext) => Generator<Event, Value, void>;

// ---------------------------------------------------------------- emitter

export type PyLine = string | { block: Stmt[] };
export type Side = "left" | "right";
export type EmitContext = {
  expr(expr: Expr): string;
  /** `expr` wrapped in parentheses when the operator table requires it under a parent of `precedence`. */
  operand(expr: Expr, precedence: number, side: Side): string;
  target(target: Target): string;
  block(stmts: Stmt[]): PyLine;
};

// ---------------------------------------------------------------- canvas text

/** `creates`: the statement is the first assignment of its variable (`templateCreate`). */
export type FormContext = { creates: boolean };

// ---------------------------------------------------------------- chart shape

/**
 * How the chart draws a block: its body regions by slot name (a branch, a checked loop, a
 * counted loop), or where its edge jumps to (out of the innermost loop, or into its next pass).
 */
export type ChartShape =
  | { branch: { yes: string; no: string } }
  | { check: string }
  | { counted: string }
  | { jump: "exit" | "next" };

// ---------------------------------------------------------------- NodeDef

export type NodeDef = {
  key: string;
  shape: "stmt" | "expr";
  category: Category;
  slots: Slot[];
  /** Builtin parameter names in order (arity = length); template placeholders use them. */
  params?: string[];
  /** Emitter aliases accepted by the parser, e.g. "random.randint". */
  aliases?: string[];
  imports?: "math" | "random";
  /** Precedence of this expression; undefined = atom. */
  precedence?: (node: Expr) => number;
  /** Not in the block menu (`empty`, `expr`). */
  hidden?: boolean;
  /** For literal blocks: the zero-like literal of the same type. */
  zeroLike?(node: Expr): Expr;
  /** For call-like expressions: what is called and with how many arguments. */
  callee?(node: Expr): Callee;
  /** Its body regions are loop bodies (`break` / `continue` allowed inside). */
  loop?: boolean;
  /** Where the statement may appear: inside a loop, or inside a function (validation). */
  requires?: "loop" | "function";
  create(): Stmt | Expr;
  run: StmtRunner | ExprRunner;
  python(node: Stmt | Expr, ctx: EmitContext): PyLine[] | string;
  /** Template variant suffix (`node.<key>.template<Form>`); `""` or absent = the base template. */
  form?(node: Stmt | Expr, ctx: FormContext): string;
  /** Canvas text of a `text` slot; default `String(node[slot])`. */
  text?(node: Stmt | Expr, slot: string): string;
  /** How the chart draws the block's regions; absent = a box with the sentence. */
  chart?: ChartShape;
  /** The kind of the expression, given the kinds of the expressions inside it. */
  kind?: (node: Expr, kindOf: (expr: Expr) => Kind | undefined) => Kind | undefined;
  /** The kind of the variable its `id` slot names. */
  declares?: Kind;
  /** The entries of the value list. */
  menu?: readonly MenuEntry[];
};

type StmtOf<K extends StmtKind> = Extract<Stmt, { kind: K }>;
type ExprOf<K extends ExprKind> = Extract<Expr, { kind: K }>;

type Generic = "shape" | "create" | "run" | "python" | "form" | "text" | "kind";

type StmtDef<K extends StmtKind> = Omit<NodeDef, Generic> & {
  create(): StmtOf<K>;
  run(node: StmtOf<K>, ctx: RunContext): Generator<Event, Signal, void>;
  python(node: StmtOf<K>, ctx: EmitContext): PyLine[];
  form?(node: StmtOf<K>, ctx: FormContext): string;
  text?(node: StmtOf<K>, slot: string): string;
};

type ExprDef<K extends ExprKind> = Omit<NodeDef, Generic> & {
  create(): ExprOf<K>;
  run(node: ExprOf<K>, ctx: RunContext): Generator<Event, Value, void>;
  python(node: ExprOf<K>, ctx: EmitContext): string;
  form?(node: ExprOf<K>, ctx: FormContext): string;
  text?(node: ExprOf<K>, slot: string): string;
  kind?(node: ExprOf<K>, kindOf: (expr: Expr) => Kind | undefined): Kind | undefined;
};

export function defineStmt<K extends StmtKind>(def: StmtDef<K>): NodeDef {
  return { shape: "stmt", ...def } as unknown as NodeDef;
}

export function defineExpr<K extends ExprKind>(def: ExprDef<K>): NodeDef {
  return { shape: "expr", ...def } as unknown as NodeDef;
}
