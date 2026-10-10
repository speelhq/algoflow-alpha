// The explanation line at the foot of the editor: what the list highlights or the caret
// is in, as a name and runs of text; undefined leaves the block's help.
import { t, type MessageKey } from "@/i18n/t";
import { chartOf, firstSetters, variableKinds } from "@/lang/kinds";
import type { Expr, Id, Kind, NodeId, Program } from "@/lang/types";
import { isEmptyExpr } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes/registry";
import {
  capitalise,
  exprTemplate,
  exprText,
  generatedText,
  sentence,
  templateParts,
  type Part,
} from "@/ui/chart/text";
import { labelOf } from "./entries";
import { find, matches, parentOf, wordRows, type Line, type LineContext, type Row } from "./line";

export type Explanation = {
  /** What is explained: a name, drawn as a variable when it is one. */
  name: string;
  variable?: boolean;
  /** The explanation; a run in backticks is a key to type. */
  parts: Part[];
};

/** A help text, its runs in backticks marked as keys. */
export function helpParts(text: string): Part[] {
  return text
    .split("`")
    .map((piece, i): Part => (i % 2 === 1 ? { text: piece, slot: "key" } : { text: piece }))
    .filter((part) => part.text !== "");
}

const kindName = (kind: Kind) => t(`editor.kind.${kind}` as MessageKey);

/** A variable of the chart that holds statement `at`: its kind and where it is first set. */
export function explainVariable(program: Program, at: NodeId, name: Id): string {
  const chart = chartOf(program, at);
  const fn = program.functions.find((candidate) => candidate.id === chart);
  const kind = variableKinds(program, chart).get(name);
  if (!fn && program.inputs.some((input) => input.name === name)) {
    return kind
      ? t("editor.explain.input", { kind: kindName(kind) })
      : t("editor.explain.inputPlain");
  }
  if (fn?.params.includes(name)) return t("editor.explain.parameter");
  const setter = firstSetters(program, chart).get(name);
  if (!setter) return t("editor.explain.newVariable", { name });
  const chartShape = getNode(keyOf(setter)).chart;
  const statement =
    chartShape && "counted" in chartShape
      ? generatedText(setter, "init")
      : capitalise(sentence(setter, program));
  return kind
    ? t("editor.explain.variable", { kind: kindName(kind), statement })
    : t("editor.explain.variablePlain", { statement });
}

/** The row's explanation. */
export function explainRow(row: Row, program: Program, at: NodeId): Explanation {
  switch (row.kind) {
    case "variable":
      return {
        name: row.name,
        variable: true,
        parts: [{ text: explainVariable(program, at, row.name) }],
      };
    case "entry":
      return { name: row.entry.label, parts: helpParts(row.entry.help) };
    case "brackets":
      return { name: t("editor.brackets"), parts: helpParts(t("editor.bracketsHelp")) };
    case "function":
      return { name: functionLabel(row.fn), parts: [{ text: t("editor.ownFunction") }] };
  }
}

/** A function as the list names it: `name(…)`, or `name()` with no parameter. */
export function functionLabel(fn: { name: string; params: readonly string[] }): string {
  return `${fn.name}(${fn.params.length > 0 ? t("chart.blank") : ""})`;
}

/** The edit distance of two words, ignoring case. */
function distance(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      next.push(Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost));
    }
    row = next;
  }
  return row[y.length] ?? 0;
}

/** The closest name to a word that matches nothing: one letter in three may differ, one at least. */
export function closestName(line: Line, ctx: LineContext): string | undefined {
  const allowed = Math.max(1, Math.floor(line.word.length / 3));
  let best: { name: string; d: number } | undefined;
  for (const row of wordRows(line, ctx)) {
    const names =
      row.kind === "variable"
        ? [row.name]
        : row.kind === "entry"
          ? [row.entry.label]
          : row.kind === "function"
            ? [row.fn.name]
            : [];
    for (const name of names) {
      const d = distance(line.word, name);
      if (d <= allowed && (!best || d < best.d)) best = { name, d };
    }
  }
  return best?.name;
}

/** The operation whose input holds the caret, and that input. */
function operationAt(line: Line): { operation: Expr; input: Expr } | undefined {
  if (line.selected) return undefined;
  const id = "at" in line.caret ? line.caret.at : line.caret.after;
  const up = parentOf(line.root, id);
  const input = find(line.root, id);
  return up && input ? { operation: up.parent, input } : undefined;
}

/** An operation's template with the caret's input underlined and every other empty one `…`. */
function operationParts(operation: Expr, current: Expr): Part[] {
  const def = getNode(keyOf(operation));
  const bag = operation as unknown as Record<string, unknown>;
  const written = (input: Expr): Part => {
    const text = isEmptyExpr(input) ? t("chart.blank") : exprText(input);
    return input === current ? { text, underline: true } : { text };
  };
  return templateParts(exprTemplate(operation), (name) => {
    const slot = def.slots.find((s) => s.name === name);
    const value = bag[name];
    if (slot?.role === "expr") return [written(value as Expr)];
    if (slot?.role === "text") return [{ text: textSlot(operation, name) }];
    if (slot?.role === "exprs" && Array.isArray(value)) {
      return (value as Expr[]).flatMap((item, i) =>
        i === 0 ? [written(item)] : [{ text: ", " }, written(item)],
      );
    }
    const index = def.params?.indexOf(name) ?? -1;
    const args = Array.isArray(bag.args) ? (bag.args as Expr[]) : [];
    const arg = index >= 0 ? args[index] : undefined;
    return arg ? [written(arg)] : [];
  });
}

function textSlot(operation: Expr, slot: string): string {
  const def = getNode(keyOf(operation));
  const value = (operation as unknown as Record<string, unknown>)[slot];
  return def.text?.(operation, slot) || (typeof value === "string" ? value : "");
}

/** The explanation of a value line, with `highlighted` the row the list highlights. */
export function explainLine(
  line: Line,
  ctx: LineContext,
  highlighted: Row | undefined,
  program: Program,
  at: NodeId,
): Explanation | undefined {
  if (line.refused) return { name: "", parts: [{ text: line.refused }] };
  if (line.word !== "" && matches(line, ctx).length === 0) {
    const closest = closestName(line, ctx);
    return {
      name: line.word,
      parts: [
        {
          text: closest ? t("editor.didYouMean", { name: closest }) : t("editor.nothingLike"),
        },
      ],
    };
  }
  if (highlighted) return explainRow(highlighted, program, at);
  const inside = operationAt(line);
  if (!inside) return undefined;
  return { name: labelOf(inside.operation), parts: operationParts(inside.operation, inside.input) };
}
