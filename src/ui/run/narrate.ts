// One sentence per event, as a message key with its params (`run.narrate.*`). Values
// are written the way blocks write them (`true`, `none`, `"text"`), never in Python notation,
// and a comparison as the chart writes it, with the values of the shown frame.
import { keyValue } from "@/lang/data";
import { errorParams, t, type MessageKey, type Params } from "@/i18n/t";
import type { Expr, Heap, Program, Value } from "@/lang/types";
import { conditionOf, diamondConditions, isExpr, nodesById, variableOf } from "@/lang/walk";
import type { Done, Event, Frame, Ref, State } from "@/runtime/types";
import { capitalise, exprText, sentence, valueText } from "@/ui/chart/text";

export type Narration = { key: MessageKey; params: Params };

export type NarrateContext = {
  program: Program;
  /** The state after the event (the driver's `state`). */
  state: State;
  /** The driver's `frame`: the frame whose variables name the values. */
  frame: number;
  /** The driver's `pass`, for a `loop` event. */
  pass: number | null;
};

/** The name a heap entry goes by: the first variable of the frame that holds it. */
function nameOf(ref: number, frame: Frame | undefined, heap: Heap): string {
  for (const [name, value] of frame?.vars ?? []) {
    if ("ref" in value && value.ref === ref) return name;
  }
  return t(heap.get(ref)?.kind === "dict" ? "run.narrate.ref.dict" : "run.narrate.ref.list");
}

function refText(ref: Ref, frame: Frame | undefined, heap: Heap): string {
  if ("var" in ref) return ref.var;
  const name = nameOf(ref.heap, frame, heap);
  if ("index" in ref) return t("run.narrate.ref.index", { index: ref.index, name });
  return t("run.narrate.ref.key", { name, key: valueText(keyValue(ref.key), heap) });
}

function valueAt(ref: Ref, frame: Frame | undefined, heap: Heap): Value | undefined {
  if ("var" in ref) return frame?.vars.get(ref.var);
  const entry = heap.get(ref.heap);
  if ("index" in ref) return entry?.kind === "list" ? entry.items[ref.index] : undefined;
  return entry?.kind === "dict" ? entry.entries.get(ref.key) : undefined;
}

/**
 * A comparison as the chart writes it, each variable that holds a number, a text, a boolean,
 * or none written as its value in the shown frame; a list keeps its name.
 */
function comparedText(expr: Expr, frame: Frame | undefined, heap: Heap): string {
  return exprText(expr, {
    value: (name) => {
      const value = frame?.vars.get(name);
      return value && !("ref" in value) ? valueText(value, heap) : undefined;
    },
  });
}

/** A diamond's question: its condition as compared, except that one variable keeps its name. */
function questionText(expr: Expr, frame: Frame | undefined, heap: Heap): string {
  return variableOf(expr) === undefined ? comparedText(expr, frame, heap) : exprText(expr);
}

export function narrate(event: Event, ctx: NarrateContext): Narration {
  const { heap } = ctx.state;
  const frame = ctx.state.frames[ctx.frame];
  const node = nodesById(ctx.program).get(event.nodeId);
  switch (event.type) {
    case "enter": {
      if (!node) return { key: "run.narrate.enter", params: { sentence: "" } };
      const condition = conditionOf(node);
      return condition
        ? { key: "run.narrate.check", params: { condition: exprText(condition.expr) } }
        : {
            key: "run.narrate.enter",
            params: { sentence: capitalise(sentence(node, ctx.program)) },
          };
    }
    case "read": {
      const [first] = event.refs;
      if (event.refs.length !== 1 || !first) {
        const heapRef = first && "heap" in first ? first.heap : -1;
        return {
          key: "run.narrate.readMany",
          params: { count: event.refs.length, name: nameOf(heapRef, frame, heap) },
        };
      }
      const value = valueAt(first, frame, heap);
      return {
        key: "run.narrate.read",
        params: {
          what: refText(first, frame, heap),
          value: value ? valueText(value, heap) : "",
        },
      };
    }
    case "compare": {
      const expr = node && isExpr(node) ? node : undefined;
      // A diamond's whole condition is its question and the edge taken; any other, its value.
      if (diamondConditions(ctx.program).has(event.nodeId)) {
        const condition = expr ? questionText(expr, frame, heap) : "";
        const answer = t(event.result ? "chart.yes" : "chart.no");
        return { key: "run.narrate.compareAnswer", params: { condition, answer } };
      }
      const condition = expr ? comparedText(expr, frame, heap) : "";
      const key = event.result ? "run.narrate.compareTrue" : "run.narrate.compareFalse";
      return { key, params: { condition } };
    }
    case "write":
      return {
        key: "run.narrate.write",
        params: { what: refText(event.ref, frame, heap), value: valueText(event.value, heap) },
      };
    case "swap": {
      const name = "heap" in event.a ? nameOf(event.a.heap, frame, heap) : "";
      return {
        key: "run.narrate.swap",
        params: {
          i: "index" in event.a ? event.a.index : "",
          j: "index" in event.b ? event.b.index : "",
          name,
        },
      };
    }
    case "loop":
      return event.var !== undefined && event.value
        ? {
            key: "run.narrate.loop",
            params: { pass: ctx.pass ?? 1, var: event.var, value: valueText(event.value, heap) },
          }
        : { key: "run.narrate.loopPlain", params: { pass: ctx.pass ?? 1 } };
    case "print":
      return { key: "run.narrate.print", params: { text: event.text } };
    case "call":
      return {
        key: "run.narrate.call",
        params: {
          fn: event.fn,
          args: event.args.map((arg) => valueText(arg, heap)).join(t("chart.listSeparator")),
        },
      };
    case "return":
      return {
        key: "run.narrate.return",
        params: { fn: event.fn, value: valueText(event.value, heap) },
      };
  }
}

/** The end of the run: `Finished in N steps`, or the error's message. */
export function narrateEnd(outcome: Done, total: number): Narration {
  return outcome.type === "error"
    ? { key: `error.${outcome.error.code}`, params: errorParams(outcome.error.params) }
    : { key: "run.narrate.done", params: { steps: total } };
}

/** What happened at the step `Watch this case` opened at. */
export function narrateDifference(difference: { line?: number }): Narration {
  return difference.line === undefined
    ? { key: "run.narrate.difference.end", params: {} }
    : { key: "run.narrate.difference.line", params: { line: difference.line } };
}

/** The driver's position, as the run store holds it. */
export type Position = {
  step: number;
  total: number;
  outcome: Done | null;
  lastEvent: Event | null;
  state: State | null;
  frame: number;
  pass: number | null;
  /** Where `Watch this case` opened. */
  difference: { step: number; line?: number } | null;
};

/** The one sentence of the narration line, and whether it is an error's message. */
export type Told = { narration: Narration; error: boolean };

/**
 * What the narration line says at a position: an error wherever the run stops on it, a
 * difference in place of its step, the end, else the event; nothing before the first step.
 */
export function narratePosition(position: Position, program: Program): Told | null {
  const { step, total, outcome, lastEvent, state, difference } = position;
  const end = outcome && step === total ? outcome : null;
  if (end?.type === "error") return { narration: narrateEnd(end, total), error: true };
  if (difference && step === difference.step) {
    return { narration: narrateDifference(difference), error: false };
  }
  if (end) return { narration: narrateEnd(end, total), error: false };
  if (!lastEvent || !state) return null;
  const { frame, pass } = position;
  return { narration: narrate(lastEvent, { program, state, frame, pass }), error: false };
}
