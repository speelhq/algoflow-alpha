// The value line: one expression edited as a line, with a caret at
// an input still to fill or after a value, the brackets opened and not yet closed, the word
// being typed, and the first key of a two-key operator. Every change is a new `Line`.
// Blocks are made by the parser (a variable, a number, a sign, a call) or by an entry's
// block (`create()` with its preset), and read through their slots and `precedence`, so this
// file names no block kind.
import { errorText } from "@/i18n/t";
import { newId } from "@/lang/id";
import type { Kinds } from "@/lang/kinds";
import { exprKind } from "@/lang/kinds";
import type { Expr, Id, NodeId } from "@/lang/types";
import { allExprs, childSlots, isEmptyExpr, variableOf } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes/registry";
import { isParseError, parse, type ParseScope } from "@/python/parse";
import { levelAssociativity } from "@/python/precedence";
import { exprTemplate, exprText } from "@/ui/chart/text";
import { allEntries, makeEntry, takesValue, type Entry } from "./entries";

type Bag = Record<string, unknown>;

/** At an input still to fill, or after a value (or after an operation, once it is left). */
export type Caret = { at: NodeId } | { after: NodeId };

export type Line = {
  root: Expr;
  caret: Caret;
  /** The whole value is selected: a value typed replaces it, an operator's key takes it. */
  selected: boolean;
  /** The brackets opened and not yet closed, innermost last, by the expression they hold. */
  open: readonly NodeId[];
  /** The word being typed at the caret. */
  word: string;
  /** The first key of a two-key operator, and the line before that key applied. */
  pending?: { key: string; before?: Line };
  /** The message of the key last refused. */
  refused?: string;
  /** The text whose field is being typed in. */
  text?: NodeId;
};

export type LineFunction = { name: Id; params: readonly Id[] };

export type LineContext = {
  /** The variables visible at the statement, the latest first. */
  variables: readonly Id[];
  kinds: Kinds;
  scope: ParseScope;
  functions: readonly LineFunction[];
};

/** A choice of the list: a variable, an entry, the brackets, or a function of the program. */
export type Row =
  | { kind: "variable"; name: Id }
  | { kind: "entry"; entry: Entry }
  | { kind: "brackets" }
  | { kind: "function"; fn: LineFunction };

/** What a key or a choice did: `move` leaves the line for the next or previous slot or item. */
export type Outcome = { line: Line; taken: boolean; move?: "next" | "previous" | "item" };

const hole = (): Expr => ({ id: newId(), kind: "empty" });

// ---------------------------------------------------------------- the tree

/** The inputs of an expression, in slot order. */
export function inputs(expr: Expr): Expr[] {
  return childSlots(expr).map((child) => child.expr);
}

export function find(root: Expr, id: NodeId): Expr | undefined {
  for (const expr of allExprs(root)) if (expr.id === id) return expr;
  return undefined;
}

/** The expression holding `id` as an input, with the input's position. */
export function parentOf(root: Expr, id: NodeId): { parent: Expr; index: number } | undefined {
  for (const expr of allExprs(root)) {
    const index = inputs(expr).findIndex((input) => input.id === id);
    if (index >= 0) return { parent: expr, index };
  }
  return undefined;
}

/** `expr` with each input replaced by what `map` makes of it. */
function mapInputs(expr: Expr, map: (input: Expr, index: number) => Expr): Expr {
  const copy = { ...expr } as unknown as Bag;
  let index = 0;
  for (const slot of getNode(keyOf(expr)).slots) {
    const value = copy[slot.name];
    if (slot.role === "expr" && value && typeof value === "object") {
      copy[slot.name] = map(value as Expr, index);
      index += 1;
    } else if (slot.role === "exprs" && Array.isArray(value)) {
      copy[slot.name] = (value as Expr[]).map((item) => {
        const made = map(item, index);
        index += 1;
        return made;
      });
    }
  }
  return copy as unknown as Expr;
}

function replaceIn(root: Expr, id: NodeId, by: Expr): Expr {
  if (root.id === id) return by;
  return mapInputs(root, (input) => replaceIn(input, id, by));
}

/** The line with expression `id` replaced; a bracket that held it holds what replaces it. */
function replace(line: Line, id: NodeId, by: Expr): Line {
  return {
    ...line,
    root: replaceIn(line.root, id, by),
    open: line.open.map((group) => (group === id ? by.id : group)),
  };
}

const precedenceOf = (expr: Expr) => getNode(keyOf(expr)).precedence?.(expr);

/** The caret stops of an expression in reading order. */
export function stops(expr: Expr): Caret[] {
  if (isEmptyExpr(expr)) return [{ at: expr.id }];
  const own = inputs(expr);
  if (own.length === 0) return [{ after: expr.id }];
  const inner = own.flatMap(stops);
  // An operation with no precedence ends after its words: a stop of its own.
  return precedenceOf(expr) === undefined ? [...inner, { after: expr.id }] : inner;
}

const sameCaret = (a: Caret, b: Caret) =>
  "at" in a ? "at" in b && a.at === b.at : "after" in b && a.after === b.after;

/** The caret at the end of `expr`. */
function endOf(expr: Expr): Caret {
  return stops(expr).at(-1) ?? { after: expr.id };
}

/** The caret's position among the stops (after an operation counts as its end). */
function position(line: Line): number {
  const all = stops(line.root);
  const exact = all.findIndex((stop) => sameCaret(stop, line.caret));
  if (exact >= 0) return exact;
  const after = "after" in line.caret ? find(line.root, line.caret.after) : undefined;
  return after ? all.findIndex((stop) => sameCaret(stop, endOf(after))) : all.length - 1;
}

function within(root: Expr, group: NodeId, id: NodeId): boolean {
  const held = find(root, group);
  return held !== undefined && find(held, id) !== undefined;
}

/** Brackets the caret has left behind close; after the value they hold, it is still inside them. */
function closeBehind(line: Line): Line {
  const { caret } = line;
  const open = line.open.filter((group) =>
    within(line.root, group, "at" in caret ? caret.at : caret.after),
  );
  return { ...line, open };
}

/** The caret is at an input still to fill (and nothing is selected). */
export function atInput(line: Line): boolean {
  return !line.selected && "at" in line.caret;
}

/** The expression before the caret: the last value, or the selected value. */
function lastValue(line: Line): Expr | undefined {
  if (line.selected) return line.root;
  return "after" in line.caret ? find(line.root, line.caret.after) : undefined;
}

/**
 * Where an operator of `level` inserted after `value` binds: it takes the largest
 * operation ending at the caret that binds tighter, within the innermost open brackets.
 * `chain` when it would chain a comparison.
 */
function bindAt(line: Line, value: Expr, level: number): Expr | "chain" {
  let target = value;
  for (;;) {
    if (line.open.includes(target.id)) return target;
    const up = parentOf(line.root, target.id);
    const outer = up ? precedenceOf(up.parent) : undefined;
    if (!up || outer === undefined || up.index !== inputs(up.parent).length - 1) return target;
    if (outer > level) target = up.parent;
    else if (outer === level && levelAssociativity(level) === "left") target = up.parent;
    else if (outer === level && levelAssociativity(level) === "none") return "chain";
    else return target;
  }
}

/** The value the list after a value is about: what an operator would take there. */
export function valueBefore(line: Line): Expr | undefined {
  const last = lastValue(line);
  if (!last || line.selected) return last;
  let target = last;
  for (;;) {
    if (line.open.includes(target.id)) return target;
    const up = parentOf(line.root, target.id);
    if (!up || precedenceOf(up.parent) === undefined) return target;
    if (up.index !== inputs(up.parent).length - 1) return target;
    target = up.parent;
  }
}

/** The kind of the value before the caret. */
export function kindBefore(line: Line, ctx: LineContext) {
  const value = valueBefore(line);
  return value ? exprKind(value, ctx.kinds) : undefined;
}

// ---------------------------------------------------------------- made by the parser

function parsed(text: string, scope?: ParseScope): Expr | undefined {
  const result = parse(text, scope);
  return isParseError(result) ? undefined : result;
}

/** A number literal for `raw`, or undefined when Python would reject it or it is no number. */
function numberOf(raw: string): Expr | undefined {
  if (!/^[0-9.]+$/.test(raw)) return undefined;
  const made = parsed(raw);
  return made && inputs(made).length === 0 && exprText(made) === raw ? made : undefined;
}

let numberKey: string | undefined;

function isNumber(expr: Expr): boolean {
  numberKey ??= keyOf(numberOf("0") ?? hole());
  return keyOf(expr) === numberKey;
}

/** `name` as a variable. */
export function variableExpr(name: Id): Expr | undefined {
  const made = parsed(name);
  return made && variableOf(made) === name ? made : undefined;
}

/** A sign before the input it leaves to fill (`−…`). */
function signExpr(): Expr | undefined {
  const made = parsed("-a");
  return made && mapInputs(made, () => hole());
}

/** A call of one of the program's functions, its arguments to fill. */
export function callExpr(fn: LineFunction, scope: ParseScope): Expr | undefined {
  const made = parsed(`${fn.name}(${fn.params.map(() => "a").join(", ")})`, scope);
  return made && mapInputs(made, () => hole());
}

// ---------------------------------------------------------------- starting

/** A line opened on `root`: at the given input, else with the value selected, else at its input. */
export function openLine(root: Expr, at?: NodeId): Line {
  const base: Line = { root, caret: endOf(root), selected: false, open: [], word: "" };
  if (at !== undefined && find(root, at) && isEmptyExpr(find(root, at))) {
    return { ...base, caret: { at } };
  }
  return isEmptyExpr(root) ? base : { ...base, selected: true };
}

/** The value removed: one input to fill, the caret at it. */
function cleared(line: Line): Line {
  const fresh = hole();
  return { ...line, root: fresh, caret: { at: fresh.id }, selected: false, open: [], word: "" };
}

const done = (line: Line): Outcome => ({ line, taken: true });
const refused = (line: Line): Outcome => ({ line, taken: false });

// ---------------------------------------------------------------- entries

/** The first input of `made` still to fill after its first, else after it. */
function caretIn(made: Expr, from = 0): Caret {
  for (const input of inputs(made).slice(from)) {
    const empty = [...allExprs(input)].find(isEmptyExpr);
    if (empty) return { at: empty.id };
  }
  return endOf(made);
}

/** `made` with `value` as its first input. */
function withFirst(made: Expr, value: Expr): Expr {
  return mapInputs(made, (input, index) => (index === 0 ? value : input));
}

/** An entry chosen after a value takes it as its first input. */
function takeValue(line: Line, entry: Entry): Outcome {
  const last = lastValue(line);
  if (!last) return refused(line);
  const made = makeEntry(entry);
  const level = precedenceOf(made);
  // An operator binds by its precedence; any other entry takes what the list was about.
  const target = line.selected
    ? last
    : level === undefined
      ? (valueBefore(line) ?? last)
      : bindAt(line, last, level);
  if (target === "chain") {
    return refused({ ...line, refused: errorText({ code: "E_PARSE_CHAIN", params: {} }) });
  }
  const placed = withFirst(made, target);
  const next = replace(line, target.id, placed);
  return done({ ...next, caret: caretIn(placed, 1), selected: false, word: "" });
}

/** A block made where a value is expected, filling the input at the caret. */
function fill(line: Line, made: Expr, text = false): Outcome {
  if (!("at" in line.caret)) return refused(line);
  const next = replace(line, line.caret.at, made);
  const caret = caretIn(made);
  return done({ ...next, caret, word: "", ...(text ? { text: made.id } : {}) });
}

/** Whether the entry's block holds a text typed in a field (`Text`). */
function typedText(made: Expr): boolean {
  return inputs(made).length === 0 && getNode(keyOf(made)).slots.some((s) => s.role === "text");
}

/** Chooses a row of the list at the caret. */
export function choose(line: Line, row: Row, ctx: LineContext): Outcome {
  let base: Line = { ...line, word: "", refused: undefined, pending: undefined };
  if (row.kind === "entry" && takesValue(row.entry) && !atInput(base)) {
    return takeValue(base, row.entry);
  }
  if (base.selected) base = cleared(base);
  if (!("at" in base.caret)) return refused(line);
  switch (row.kind) {
    case "variable": {
      const made = variableExpr(row.name);
      return made ? fill(base, made) : refused(line);
    }
    case "function": {
      const made = callExpr(row.fn, ctx.scope);
      return made ? fill(base, made) : refused(line);
    }
    case "brackets":
      return done({ ...base, open: [...base.open, base.caret.at] });
    case "entry": {
      const made = makeEntry(row.entry);
      return fill(base, made, typedText(made));
    }
  }
}

// ---------------------------------------------------------------- words

/** The words of a name: split at spaces, `_`, and `-`. */
function wordsOf(name: string): string[] {
  return name.toLowerCase().split(/[\s_-]+/);
}

/** Whether a typed word matches a name (one of its words starts with it) or an entry's keys. */
function matchesName(name: string, word: string): boolean {
  const w = word.toLowerCase();
  return wordsOf(name).some((part) => part.startsWith(w)) || name.toLowerCase().startsWith(w);
}

function rowName(row: Row): string {
  switch (row.kind) {
    case "variable":
      return row.name;
    case "entry":
      return row.entry.label;
    case "function":
      return row.fn.name;
    case "brackets":
      return "";
  }
}

/** Whether the row is named exactly by the word: its name, or the entry's keys. */
export function namesExactly(row: Row, word: string): boolean {
  if (row.kind === "entry" && row.entry.menu.keys === word) return true;
  return rowName(row).toLowerCase() === word.toLowerCase();
}

/** The rows a word can name at the caret: where a value is expected, or after one. */
export function wordRows(line: Line, ctx: LineContext): Row[] {
  if (atInput(line) || (line.selected && line.word !== "")) {
    return [
      ...ctx.variables.map((name): Row => ({ kind: "variable", name })),
      ...allEntries()
        .filter((entry) => !takesValue(entry))
        .map((entry): Row => ({ kind: "entry", entry })),
      ...ctx.functions.map((fn): Row => ({ kind: "function", fn })),
    ];
  }
  return allEntries()
    .filter(takesValue)
    .map((entry): Row => ({ kind: "entry", entry }));
}

/** The rows matching the word typed: a whole name first, then, after a value, its kind's. */
export function matches(line: Line, ctx: LineContext): Row[] {
  const word = line.word;
  if (word === "") return [];
  const kind = atInput(line) ? undefined : kindBefore(line, ctx);
  const found = wordRows(line, ctx).filter(
    (row) =>
      matchesName(rowName(row), word) ||
      (row.kind === "entry" && (row.entry.menu.keys ?? "").startsWith(word)),
  );
  const rank = (row: Row) =>
    namesExactly(row, word)
      ? 0
      : kind !== undefined && row.kind === "entry" && row.entry.menu.on?.includes(kind)
        ? 1
        : 2;
  return found
    .map((row, index) => ({ row, index }))
    .toSorted((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** The row the word names exactly, if any. */
export function exactRow(line: Line, ctx: LineContext): Row | undefined {
  return matches(line, ctx).find((row) => namesExactly(row, line.word));
}

/** The word typed, chosen when it names a row exactly, as when the line is left. */
export function settle(line: Line, ctx: LineContext): Line {
  const exact = line.word === "" ? undefined : exactRow(line, ctx);
  return exact ? choose(line, exact, ctx).line : line;
}

// ---------------------------------------------------------------- typing

/** The keys that end a word. */
const ENDS_WORD = /^[-+*/%<>=!(),[\]]$/;

const entryByKeys = (keys: string) => allEntries().find((entry) => entry.menu.keys === keys);
const startsKeys = (key: string) =>
  allEntries().some(
    (entry) => (entry.menu.keys ?? "").length > key.length && entry.menu.keys?.startsWith(key),
  );

function typeDigit(line: Line, ch: string): Outcome {
  const base = line.selected ? cleared(line) : line;
  if ("at" in base.caret) {
    const made = numberOf(ch);
    return made ? fill(base, made) : refused(line);
  }
  const last = find(base.root, base.caret.after);
  if (!last || !isNumber(last)) return refused(line);
  const made = numberOf(exprText(last) + ch);
  if (!made) return refused(line);
  return done(replace(base, last.id, { ...made, id: last.id }));
}

/** One key typed in the line. */
export function type(line: Line, key: string, ctx: LineContext): Outcome {
  if (key.length !== 1) return refused(line);
  let current: Line = { ...line, refused: undefined };
  if (/[A-Za-z_]/.test(key) || (current.word !== "" && /[0-9]/.test(key))) {
    if (current.word === "" && current.selected) current = cleared(current);
    return done({ ...current, word: current.word + key, pending: undefined });
  }
  if (current.word !== "") {
    // A space or a key of the table ends the word when it names one; else the word stays.
    if (key !== " " && !ENDS_WORD.test(key)) return refused(line);
    const exact = exactRow(current, ctx);
    if (!exact) return refused(line);
    const chosen = choose(current, exact, ctx);
    // A call's `(` is the bracket the call already has.
    if (!chosen.taken || key === " " || (key === "(" && exact.kind === "function")) return chosen;
    current = chosen.line;
  }
  if (key === " ") return done(current);
  if (current.pending) {
    const entry = entryByKeys(current.pending.key + key);
    const before = current.pending.before ?? current;
    current = { ...current, pending: undefined };
    if (entry) return takeValue({ ...before, pending: undefined }, entry);
  }
  if (/[0-9.]/.test(key)) return typeDigit(current, key);
  const value = !atInput(current);
  switch (key) {
    case "(": {
      const base = current.selected ? cleared(current) : current;
      return "at" in base.caret
        ? done({ ...base, open: [...base.open, base.caret.at] })
        : refused(line);
    }
    case ")": {
      const group = current.open.at(-1);
      if (group === undefined) return leave(current) ?? refused(line);
      const held = find(current.root, group);
      return done({
        ...current,
        open: current.open.slice(0, -1),
        caret: { after: held ? held.id : group },
      });
    }
    case ",":
      return { line: current, taken: true, move: "item" };
    case "-":
      if (!value || current.selected) {
        const base = current.selected ? cleared(current) : current;
        const sign = signExpr();
        return sign ? fill(base, sign) : refused(line);
      }
      break;
    default:
      break;
  }
  const entry = entryByKeys(key);
  if (entry && value) {
    const placed = takeValue(current, entry);
    if (placed.taken && startsKeys(key)) placed.line.pending = { key, before: current };
    return placed;
  }
  if (value && startsKeys(key)) return done({ ...current, pending: { key } });
  return refused(line);
}

/** `)` with no bracket open closes the brackets of the innermost call around the caret. */
function leave(line: Line): Outcome | undefined {
  const { caret, root } = line;
  const bracketed = (expr: Expr) => /\)\s*$/.test(exprTemplate(expr));
  let up = parentOf(root, "at" in caret ? caret.at : caret.after);
  while (up && !bracketed(up.parent)) up = parentOf(root, up.parent.id);
  return up ? done({ ...line, caret: { after: up.parent.id }, pending: undefined }) : undefined;
}

// ---------------------------------------------------------------- removing and moving

/** Whether an operation's template ends with its own words (`{x} as text`). */
const endsInWords = (expr: Expr) => !/\}\s*$/.test(exprTemplate(expr));

/** Backspace removes what is before the caret. */
export function backspace(line: Line): Outcome {
  const current: Line = { ...line, refused: undefined, pending: undefined };
  if (current.word !== "") return done({ ...current, word: current.word.slice(0, -1) });
  if (current.selected) return done(cleared(current));
  const { caret, root } = current;
  if ("after" in caret) {
    const last = find(root, caret.after);
    if (!last) return refused(line);
    if (isNumber(last) && exprText(last).length > 1) {
      const made = numberOf(exprText(last).slice(0, -1));
      if (made) return done(replace(current, last.id, { ...made, id: last.id }));
    }
    const own = inputs(last);
    const [first] = own;
    if (first) {
      // An operation that ends in an input: what is before the caret is that input's end.
      if (!endsInWords(last)) {
        const end = own.at(-1);
        return end ? backspace({ ...current, caret: endOf(end) }) : refused(line);
      }
      const next = replace(current, last.id, first);
      return done({ ...next, caret: endOf(first) });
    }
    const fresh = hole();
    return done({ ...replace(current, last.id, fresh), caret: { at: fresh.id } });
  }
  if (current.open.at(-1) === caret.at)
    return done({ ...current, open: current.open.slice(0, -1) });
  const up = parentOf(root, caret.at);
  if (!up) return refused(line);
  const own = inputs(up.parent);
  const [first] = own;
  if (!first) return refused(line);
  // While an input after the first holds a value, removing the operation would lose it.
  if (own.slice(1).some((input) => !isEmptyExpr(input))) return move(current, -1);
  if (up.index === 0) {
    const next = replace(current, up.parent.id, first);
    return done({ ...next, caret: { at: first.id } });
  }
  const next = replace(current, up.parent.id, first);
  return done({ ...next, caret: endOf(first) });
}

/** ← and →: the previous or next value or input. */
export function move(line: Line, step: -1 | 1): Outcome {
  const all = stops(line.root);
  if (line.selected) {
    const caret = step < 0 ? all[0] : all.at(-1);
    return done(closeBehind({ ...line, selected: false, caret: caret ?? line.caret }));
  }
  const here = position(line);
  // → at the end of an operation's last input leaves the operation.
  const target = all[here + step];
  if (!target) return refused(line);
  return done(closeBehind({ ...line, caret: target, pending: undefined, refused: undefined }));
}

/** Tab and Shift+Tab: the next or previous input still to fill, else the next or previous slot. */
export function tab(line: Line, step: -1 | 1, ctx: LineContext): Outcome {
  let current: Line = { ...line, pending: undefined, refused: undefined };
  if (current.word !== "") {
    const exact = exactRow(current, ctx);
    current = exact ? choose(current, exact, ctx).line : { ...current, word: "" };
  }
  const all = stops(current.root);
  const here = current.selected ? (step > 0 ? all.length - 1 : 0) : position(current);
  const fields = all
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop, index }) => "at" in stop && (step > 0 ? index > here : index < here));
  const field = step > 0 ? fields[0] : fields.at(-1);
  if (!field) return { line: current, taken: true, move: step > 0 ? "next" : "previous" };
  return done(closeBehind({ ...current, caret: field.stop, selected: false }));
}

/** A click on a value puts the caret after it, and on an input at it. */
export function clickAt(line: Line, id: NodeId): Line {
  const clicked = find(line.root, id);
  if (!clicked) return line;
  const caret: Caret = isEmptyExpr(clicked) ? { at: id } : endOf(clicked);
  return closeBehind({ ...line, caret, selected: false, word: "", pending: undefined });
}

/** The text being typed changes. */
export function setText(line: Line, id: NodeId, text: string): Line {
  const held = find(line.root, id);
  const slot = held ? getNode(keyOf(held)).slots.find((s) => s.role === "text") : undefined;
  if (!held || !slot) return line;
  return replace(line, id, { ...held, [slot.name]: text });
}

/** The text field ends; the caret is after the text. */
export function endText(line: Line): Line {
  return line.text === undefined ? line : { ...line, text: undefined, caret: { after: line.text } };
}

/** The operator clicked is replaced by another entry of its block in its group. */
export function switchTo(line: Line, id: NodeId, entry: Entry): Line {
  const held = find(line.root, id);
  if (!held) return line;
  return replace(line, id, { ...held, ...entry.menu.preset });
}
