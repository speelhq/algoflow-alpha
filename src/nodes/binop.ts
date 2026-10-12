// The `binop` block: arithmetic, comparison, logic, and `in`, with the reads of `in`, the
// `compare` events, and the operator precedence of the emitted text.
import { dictKey } from "@/lang/data";
import { newId } from "@/lang/id";
import { KINDS, type Expr, type Value } from "@/lang/types";
import { binopPrecedence, isBinOp, isComparison } from "@/python/precedence";
import { typeError } from "@/runtime/access";
import type { Event, Ref } from "@/runtime/types";
import {
  compare,
  entryOf,
  equals,
  floatFloorDiv,
  floatMod,
  isNumber,
  makeNumber,
  truthy,
} from "@/runtime/values";
import { defineExpr, type RunContext } from "./types";
import { emptyExpr } from "./empty";

type Binop = Extract<Expr, { kind: "binop" }>;

/** The kinds `<`, `≤`, `>`, and `≥` order. */
const ORDERED = ["number", "text"] as const;

function arithmetic(node: Binop, l: Value, r: Value, ctx: RunContext): Value {
  if (node.op === "+" && l.t === "str" && r.t === "str") return { t: "str", v: l.v + r.v };
  if (!isNumber(l) || !isNumber(r)) return typeError(node.id, l, r, ctx);
  const float = l.t === "float" || r.t === "float";
  const a = l.v;
  const b = r.v;
  switch (node.op) {
    case "+":
      return makeNumber(a + b, float);
    case "-":
      return makeNumber(a - b, float);
    case "*":
      return makeNumber(a * b, float);
    case "/":
      if (b === 0) return ctx.fail(node.id, "E_DIV_ZERO");
      return { t: "float", v: a / b };
    case "//":
      if (b === 0) return ctx.fail(node.id, "E_DIV_ZERO");
      return float ? { t: "float", v: floatFloorDiv(a, b) } : makeNumber(Math.floor(a / b), false);
    case "%":
      if (b === 0) return ctx.fail(node.id, "E_DIV_ZERO");
      return float
        ? { t: "float", v: floatMod(a, b) }
        : makeNumber(a - b * Math.floor(a / b), false);
    case "**":
      if (a === 0 && b < 0) return ctx.fail(node.id, "E_DIV_ZERO");
      if (float || b < 0) return { t: "float", v: a ** b };
      return makeNumber(a ** b, false);
    default:
      return typeError(node.id, l, r, ctx);
  }
}

function ordered(node: Binop, l: Value, r: Value, ctx: RunContext): boolean {
  if (node.op === "==") return equals(l, r, ctx.heap);
  if (node.op === "!=") return !equals(l, r, ctx.heap);
  const c = compare(l, r);
  if (c === undefined) return typeError(node.id, l, r, ctx);
  switch (node.op) {
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    case ">":
      return c > 0;
    case ">=":
      return c >= 0;
    default:
      return typeError(node.id, l, r, ctx);
  }
}

/** One ref per compared list element. */
function* membership(
  node: Binop,
  l: Value,
  r: Value,
  ctx: RunContext,
): Generator<Event, boolean, void> {
  if (r.t === "list") {
    const entry = entryOf(ctx.heap, r.ref);
    if (entry.kind !== "list") return false;
    const refs: Ref[] = [];
    let found = false;
    for (let i = 0; i < entry.items.length; i += 1) {
      refs.push({ heap: r.ref, index: i });
      if (equals(l, entry.items[i] ?? { t: "none" }, ctx.heap)) {
        found = true;
        break;
      }
    }
    if (refs.length > 0) yield { type: "read", nodeId: node.id, refs };
    return found;
  }
  if (r.t === "dict") {
    const key = dictKey(l);
    if (key === undefined) return typeError(node.id, l, r, ctx);
    const entry = entryOf(ctx.heap, r.ref);
    return entry.kind === "dict" && entry.entries.has(key);
  }
  if (r.t === "str") {
    if (l.t !== "str") return typeError(node.id, l, r, ctx);
    return r.v.includes(l.v);
  }
  return typeError(node.id, l, r, ctx);
}

export const binop = defineExpr<"binop">({
  key: "binop",
  category: "basic",
  slots: [
    { name: "op", role: "text", required: true },
    { name: "left", role: "expr", required: true },
    { name: "right", role: "expr", required: true },
  ],
  precedence: (node) => binopPrecedence((node as Binop).op),
  create: () => ({ id: newId(), kind: "binop", op: "+", left: emptyExpr(), right: emptyExpr() }),
  fieldsError: (fields) =>
    typeof fields.op === "string" && isBinOp(fields.op)
      ? undefined
      : { field: "op", message: "expected a known operator" },
  *run(node, ctx) {
    if (node.op === "and" || node.op === "or") {
      // Short-circuit, returning the deciding operand
      const left = yield* ctx.eval(node.left);
      const decided = node.op === "and" ? !truthy(left, ctx.heap) : truthy(left, ctx.heap);
      if (decided) return left;
      return yield* ctx.eval(node.right);
    }
    const left = yield* ctx.eval(node.left);
    const right = yield* ctx.eval(node.right);
    if (isComparison(node.op)) {
      const result =
        node.op === "in"
          ? yield* membership(node, left, right, ctx)
          : ordered(node, left, right, ctx);
      yield { type: "compare", nodeId: node.id, result };
      return { t: "bool", v: result };
    }
    return arithmetic(node, left, right, ctx);
  },
  python: (node, ctx) => {
    const precedence = binopPrecedence(node.op);
    return `${ctx.operand(node.left, precedence, "left")} ${node.op} ${ctx.operand(node.right, precedence, "right")}`;
  },
  // `%`, `//`, `**`, and `in` are written in words, each with a template of its own.
  form: (node) => WORD_FORMS[node.op] ?? "",
  // The other operators are written with the symbols taught at school.
  text: (node, slot) => (slot === "op" ? (CANVAS_OPS[node.op] ?? node.op) : ""),
  kind: (node, kindOf) => {
    if (isComparison(node.op)) return "truefalse";
    const left = kindOf(node.left);
    const right = kindOf(node.right);
    const same = left !== undefined && left === right ? left : undefined;
    if (node.op === "and" || node.op === "or") return same;
    if (node.op === "+") return same === "truefalse" ? undefined : same;
    if (node.op === "*") {
      const repeated = [left, right].find((kind) => kind === "list" || kind === "text");
      if (repeated) return repeated;
    }
    return "number";
  },
  menu: [
    { name: "and", group: "conditions", on: ["truefalse"], preset: { op: "and" }, keys: "and" },
    { name: "or", group: "conditions", on: ["truefalse"], preset: { op: "or" }, keys: "or" },
    {
      name: "add",
      group: "calculate",
      on: ["number", "text"],
      preset: { op: "+" },
      symbol: "+",
      keys: "+",
    },
    {
      name: "sub",
      group: "calculate",
      on: ["number"],
      preset: { op: "-" },
      symbol: "−",
      keys: "-",
    },
    {
      name: "mul",
      group: "calculate",
      on: ["number"],
      preset: { op: "*" },
      symbol: "×",
      keys: "*",
    },
    {
      name: "div",
      group: "calculate",
      on: ["number"],
      preset: { op: "/" },
      symbol: "÷",
      keys: "/",
    },
    { name: "mod", group: "calculate", on: ["number"], preset: { op: "%" }, keys: "%" },
    { name: "floorDiv", group: "calculate", on: ["number"], preset: { op: "//" }, keys: "//" },
    { name: "pow", group: "calculate", on: ["number"], preset: { op: "**" }, keys: "**" },
    { name: "join", group: "items", on: ["list"], preset: { op: "+" }, symbol: "+" },
    { name: "eq", group: "compare", on: KINDS, preset: { op: "==" }, symbol: "=", keys: "==" },
    { name: "ne", group: "compare", on: KINDS, preset: { op: "!=" }, symbol: "≠", keys: "!=" },
    { name: "lt", group: "compare", on: ORDERED, preset: { op: "<" }, symbol: "<", keys: "<" },
    { name: "le", group: "compare", on: ORDERED, preset: { op: "<=" }, symbol: "≤", keys: "<=" },
    { name: "gt", group: "compare", on: ORDERED, preset: { op: ">" }, symbol: ">", keys: ">" },
    { name: "ge", group: "compare", on: ORDERED, preset: { op: ">=" }, symbol: "≥", keys: ">=" },
    { name: "in", group: "compare", on: KINDS, preset: { op: "in" }, keys: "in" },
  ],
});

const WORD_FORMS: Partial<Record<Binop["op"], string>> = {
  "%": "Mod",
  "//": "FloorDiv",
  "**": "Pow",
  in: "In",
};

const CANVAS_OPS: Partial<Record<Binop["op"], string>> = {
  "-": "−",
  "*": "×",
  "/": "÷",
  "==": "=",
  "!=": "≠",
  "<=": "≤",
  ">=": "≥",
};
