// A node's text from `node.<key>.template<form>` and the block's slots, as runs: the words of
// a template, a variable (drawn bold in its own colour), and the placeholder of an input still
// to fill. Only operators are written as symbols; an operation written in words is bracketed
// next to an operator and inside another operation's input, and operators among themselves
// are parenthesised as the emitter does. Reads slot roles, `params`, `form`, `text`, and
// `precedence` only, never a kind.
import { t, type MessageKey } from "@/i18n/t";
import { toValue } from "@/lang/data";
import type { Data, Expr, Heap, Node, NodeId, Program, Target, Value } from "@/lang/types";
import { firstAssignments } from "@/lang/validate";
import { isEmptyExpr, isExpr, variableOf } from "@/lang/walk";
import { getNode, hasNode, keyOf } from "@/nodes/registry";
import type { NodeDef, Side } from "@/nodes/types";
import { writeTarget } from "@/python/emit";
import { needsParens } from "@/python/precedence";
import { str, writeValue } from "@/runtime/values";

type Bag = Record<string, unknown>;

/** The one place a registry key becomes an i18n key (the key check does not scan dynamic keys). */
export function nodeText(key: string, part: string, params?: Record<string, string>): string {
  return t(`node.${key}.${part}` as MessageKey, params);
}

/** A template with every `{slot}` written as `…`. */
export function blankTemplate(template: string): string {
  return template.replace(/\{\w+\}/g, t("chart.blank"));
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A run of a node's text: the template's own words, or what a slot holds (`slot` names the
 * statement's slot it belongs to). `variable` marks a variable's name, `empty` the placeholder
 * of an input still to fill, and `hole` that input's expression.
 */
export type Part = {
  text: string;
  slot?: string;
  empty?: boolean;
  hole?: NodeId;
  variable?: boolean;
  /** The input the editor's caret is in. */
  underline?: boolean;
};

/** The text the parts spell. */
export function joinParts(parts: readonly Part[]): string {
  return parts.map((part) => part.text).join("");
}

/** The empty slot's placeholder, `choose a value`. */
export function placeholder(): string {
  return nodeText("empty", "template");
}

/** How an expression is written: `value` gives the text a variable is written as instead of its name. */
export type Writing = { value?: (name: string) => string | undefined };

/**
 * A template as parts, each placeholder replaced by the parts `fill` gives. Spaces are collapsed
 * across parts as in a sentence, and a part left with no text is dropped.
 */
export function templateParts(template: string, fill: (name: string) => Part[]): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    parts.push({ text: template.slice(at, found.index) });
    parts.push(...fill(found[1] ?? ""));
    at = found.index + found[0].length;
  }
  parts.push({ text: template.slice(at) });
  const out: Part[] = [];
  for (const part of parts) {
    const before = out[out.length - 1]?.text ?? "";
    let text = part.text.replace(/\s+/g, " ");
    if (before === "" || before.endsWith(" ")) text = text.replace(/^ /, "");
    if (text !== "") out.push({ ...part, text });
  }
  const last = out[out.length - 1];
  if (last) last.text = last.text.replace(/ $/, "");
  // Adjacent words of one slot are one run.
  const merged: Part[] = [];
  for (const part of out) {
    const before = merged[merged.length - 1];
    if (before && plain(before) && plain(part) && before.slot === part.slot) {
      before.text += part.text;
    } else if (part.text !== "") merged.push({ ...part });
  }
  return merged;
}

const plain = (part: Part) => !part.variable && !part.empty && !part.underline;

/** The template of an expression in its form. */
export function exprTemplate(expr: Expr): string {
  const def = getNode(keyOf(expr));
  return nodeText(def.key, `template${def.form?.(expr, { creates: false }) ?? ""}`);
}

const hasInputs = (def: NodeDef) =>
  def.params !== undefined || def.slots.some((s) => s.role === "expr" || s.role === "exprs");

/** An operation written in words around its inputs (`remainder of i divided by 15`). */
export function isWordOperation(expr: Expr): boolean {
  const def = getNode(keyOf(expr));
  return hasInputs(def) && /\p{L}/u.test(exprTemplate(expr).replace(/\{\w+\}/g, ""));
}

/** An operation written with a symbol, which has a precedence (`+`, `=`, `−`). */
export function isOperator(expr: Expr): boolean {
  return getNode(keyOf(expr)).precedence?.(expr) !== undefined && !isWordOperation(expr);
}

const precedenceOf = (expr: Expr) => getNode(keyOf(expr)).precedence?.(expr);

/** Whether `child`, an input of `parent` on `side`, is put in brackets. */
export function bracketed(child: Expr, parent: Expr, side: Side): boolean {
  if (isWordOperation(parent)) return isWordOperation(child) || isOperator(child);
  if (!isOperator(parent)) return false;
  if (isWordOperation(child)) return true;
  const own = precedenceOf(child);
  const outer = precedenceOf(parent);
  return own !== undefined && outer !== undefined && isOperator(child)
    ? needsParens(own, outer, side)
    : false;
}

function inBrackets(parts: Part[]): Part[] {
  return [{ text: "(" }, ...parts, { text: ")" }];
}

/** The parts of an input of `parent`. */
function operandParts(child: Expr, parent: Expr, side: Side, writing: Writing): Part[] {
  const parts = exprParts(child, writing);
  return bracketed(child, parent, side) ? inBrackets(parts) : parts;
}

/** An expression as the chart writes it. */
export function exprParts(expr: Expr, writing: Writing = {}): Part[] {
  if (isEmptyExpr(expr)) return [{ text: placeholder(), empty: true, hole: expr.id }];
  const name = variableOf(expr);
  if (name !== undefined) {
    const value = writing.value?.(name);
    return value === undefined ? [{ text: name, variable: true }] : [{ text: value }];
  }
  const def = getNode(keyOf(expr));
  const bag = expr as unknown as Bag;
  const first = def.slots.find((s) => s.role === "expr");
  return templateParts(exprTemplate(expr), (placeholderName) => {
    const slot = def.slots.find((s) => s.name === placeholderName);
    const value = slot ? bag[slot.name] : undefined;
    switch (slot?.role) {
      case "expr":
        return isExpr(value)
          ? operandParts(value, expr, slot === first ? "left" : "right", writing)
          : [];
      case "exprs":
        return listParts(Array.isArray(value) ? value.filter(isExpr) : [], (item) =>
          exprParts(item, writing),
        );
      case "id":
        return [{ text: typeof value === "string" ? value : "" }];
      case "text":
        return [{ text: textOf(expr, def, slot.name) }];
      case undefined: {
        // Builtin templates name their parameters (`{a}`, `{b}`): the i-th argument.
        const index = def.params?.indexOf(placeholderName) ?? -1;
        const arg =
          index >= 0 && Array.isArray(bag.args) ? (bag.args[index] as unknown) : undefined;
        return isExpr(arg) ? operandParts(arg, expr, index === 0 ? "left" : "right", writing) : [];
      }
      default:
        return [];
    }
  });
}

function listParts(items: Expr[], write: (item: Expr) => Part[]): Part[] {
  return items.flatMap((item, i) => (i === 0 ? write(item) : [{ text: ", " }, ...write(item)]));
}

function textOf(node: Node, def: NodeDef, slot: string): string {
  const value = (node as unknown as Bag)[slot];
  return (
    def.text?.(node, slot) ||
    (typeof value === "string" || typeof value === "number" ? String(value) : "")
  );
}

/** The text of an expression as the chart writes it. */
export function exprText(expr: Expr, writing: Writing = {}): string {
  return joinParts(exprParts(expr, writing));
}

/** A target reads as the expression of the same shape once that block exists (`index`, `key`, `field`). */
function targetParts(target: Target): Part[] {
  const { kind, ...rest } = target;
  if (kind === "var") return [{ text: target.name, variable: true }];
  if (hasNode(kind)) return exprParts({ id: "", kind, ...rest } as Expr);
  return [{ text: writeTarget(target, (expr) => exprText(expr)) }];
}

/** Whether a slot holds nothing yet: an empty expression, an empty name, or no item. */
function isEmptySlot(node: Node, def: NodeDef, name: string): boolean {
  const slot = def.slots.find((s) => s.name === name);
  const value = (node as unknown as Bag)[name];
  switch (slot?.role) {
    case "expr":
      return isEmptyExpr(value);
    case "exprs":
      // A list with no item is empty only where the slot is required.
      return Array.isArray(value) && value.length === 0 && slot.required === true;
    case "id":
      return value === "";
    case "target":
      return (
        (value as Target | undefined)?.kind === "var" && (value as { name: string }).name === ""
      );
    default:
      return false;
  }
}

/** The parts of one slot of a statement, each naming the slot. */
function stmtSlotParts(node: Node, def: NodeDef, name: string): Part[] {
  const slot = def.slots.find((s) => s.name === name);
  if (!slot) return [];
  const value = (node as unknown as Bag)[name];
  const parts = (): Part[] => {
    if (isEmptySlot(node, def, name)) return [{ text: placeholder(), empty: true }];
    switch (slot.role) {
      case "expr":
        return isExpr(value) ? exprParts(value) : [];
      case "exprs":
        return listParts(Array.isArray(value) ? value.filter(isExpr) : [], (item) =>
          exprParts(item),
        );
      case "id":
        return [{ text: typeof value === "string" ? value : "", variable: true }];
      case "target":
        return value && typeof value === "object" ? targetParts(value as Target) : [];
      case "text":
        return [{ text: textOf(node, def, name) }];
      default:
        return [];
    }
  };
  return parts().map((part) => ({ ...part, slot: name }));
}

/** A statement template as parts, one or more per slot. */
function stmtParts(template: string, node: Node): Part[] {
  const def = getNode(keyOf(node));
  return templateParts(template, (name) => stmtSlotParts(node, def, name));
}

/** The sentence of a statement or expression, as written in the catalog (not capitalised). */
export function sentence(node: Node, program: Program): string {
  const def = getNode(keyOf(node));
  if (def.shape === "expr") return exprText(node as Expr);
  return joinParts(sentenceParts(node, program));
}

/** The template of a statement in its form for this program (`templateCreate`, …). */
export function templateOf(node: Node, program: Program): string {
  const def = getNode(keyOf(node));
  const form = def.form?.(node, { creates: firstAssignments(program).has(node.id) }) ?? "";
  return nodeText(def.key, `template${form}`);
}

/** A statement's sentence as parts (not capitalised). */
export function sentenceParts(node: Node, program: Program): Part[] {
  return stmtParts(templateOf(node, program), node);
}

/** A sentence drawn on a node: capitalised when it begins with a word of its template. */
export function drawn(parts: Part[]): Part[] {
  const [first, ...rest] = parts;
  if (!first || first.slot !== undefined) return parts;
  return [{ ...first, text: capitalise(first.text) }, ...rest];
}

/** The text of a generated node (`init`, `check`, `step`), with the loop's own slots. */
export function generatedText(node: Node, part: "init" | "check" | "step"): string {
  return joinParts(generatedParts(node, part));
}

/** A generated node's text as parts, its slots being the loop's. */
export function generatedParts(node: Node, part: "init" | "check" | "step"): Part[] {
  return stmtParts(nodeText(getNode(keyOf(node)).key, part), node);
}

/** A diamond's text: its condition followed by `?`, or the placeholder without it. */
export function questionParts(node: Node): Part[] {
  const def = getNode(keyOf(node));
  const slot = def.slots.find((s) => s.role === "expr")?.name;
  const condition = conditionOf(node);
  if (!slot || !condition) return [];
  const parts = exprParts(condition).map((part) => ({ ...part, slot }));
  if (isEmptyExpr(condition)) return parts;
  return templateParts(t("chart.condition"), () => parts);
}

/** The expression a diamond asks about: the block's first `expr` slot (`branch`, `check`). */
export function conditionOf(node: Node): Expr | undefined {
  const def = getNode(keyOf(node));
  const slot = def.slots.find((s) => s.role === "expr");
  const value = slot ? (node as unknown as Bag)[slot.name] : undefined;
  return isExpr(value) ? value : undefined;
}

/** A value as the blocks write it: `true` / `false` / `none`, a text in quotes, the rest as `str()`. */
export function valueText(value: Value, heap: Heap): string {
  return writeValue(value, heap, (scalar) => {
    switch (scalar.t) {
      case "bool":
        return t(scalar.v ? "node.bool.template" : "node.bool.templateFalse");
      case "none":
        return t("node.none.template");
      case "str":
        return t("node.str.template", { value: scalar.v });
      default:
        return str(scalar, heap);
    }
  });
}

/** A case's input value (`Input n = 15`), written like any other value. */
export function dataText(data: Data): string {
  const heap: Heap = new Map();
  return valueText(toValue(data, heap), heap);
}

/** An Input node's text, its name a variable (`Input n = 15`). */
export function inputParts(name: string, value: Data): Part[] {
  return templateParts(t("chart.input"), (placeholderName) =>
    placeholderName === "name" ? [{ text: name, variable: true }] : [{ text: dataText(value) }],
  );
}
