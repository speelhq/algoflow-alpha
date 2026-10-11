// The fields of a statement's sentence in the node editor: each name slot, each value slot, and
// each item of a list of values, in the sentence's reading order.
import { nodeText } from "@/i18n/t";
import { setSlot } from "@/lang/edit";
import type { Expr, NodeId, Program, Stmt, Target } from "@/lang/types";
import { allExprs, isEmptyExpr, isExpr } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes/registry";
import { placeholderValue, templateOf, templatePieces } from "@/ui/chart/text";
import { find } from "./line";

type Bag = Record<string, unknown>;

/** One editable slot of the sentence: a name, a value, or an item of a list of values. */
export type Field = { slot: string; role: "id" | "target" | "expr"; index?: number };

export const fieldKey = (field: Field) => `${field.slot}:${field.index ?? ""}`;

export const sameField = (a: Field | null, b: Field | null) =>
  a !== null && b !== null && fieldKey(a) === fieldKey(b);

/** The name in an `id` slot, or in a `target` slot holding a variable. */
export function nameOf(stmt: Stmt, slot: string): string | undefined {
  const value = (stmt as unknown as Bag)[slot];
  if (typeof value === "string") return value;
  const target = value as Target | undefined;
  return target?.kind === "var" ? target.name : undefined;
}

/** The program with `name` in the name slot `slot` of `stmt`. */
export function setName(program: Program, stmt: Stmt, slot: string, name: string): Program {
  const role = getNode(keyOf(stmt)).slots.find((s) => s.name === slot)?.role;
  return setSlot(program, stmt.id, slot, role === "target" ? { kind: "var", name } : name);
}

/** The fields of the sentence, in its reading order. */
export function fieldsOf(stmt: Stmt, program: Program): Field[] {
  const out: Field[] = [];
  for (const piece of templatePieces(templateOf(stmt, program))) {
    if ("words" in piece) continue;
    const held = placeholderValue(stmt, piece.name);
    const slot = piece.name;
    if ((held?.role === "id" || held?.role === "target") && nameOf(stmt, slot) !== undefined) {
      out.push({ slot, role: held.role });
    } else if (held?.role === "expr" && held.expr) out.push({ slot, role: "expr" });
    else if (held?.role === "exprs") {
      held.items.forEach((_, index) => out.push({ slot, role: "expr", index }));
    }
  }
  return out;
}

/** A slot's accessible name: the template's words just before it, else the block's label. */
export function fieldLabel(stmt: Stmt, program: Program, slot: string): string {
  const pieces = templatePieces(templateOf(stmt, program));
  const before = pieces[pieces.findIndex((piece) => "name" in piece && piece.name === slot) - 1];
  const words = before && "words" in before ? before.words.trim() : "";
  return words !== "" ? words : nodeText(getNode(keyOf(stmt)).key, "label");
}

/** The expression a value field holds. */
export function valueOf(stmt: Stmt, field: Field): Expr | undefined {
  const value = (stmt as unknown as Bag)[field.slot];
  const item =
    field.index === undefined ? value : Array.isArray(value) ? value[field.index] : undefined;
  return isExpr(item) ? item : undefined;
}

/** Whether a field still has something to fill: an empty name or an input at any depth. */
function toFill(stmt: Stmt, field: Field): boolean {
  if (field.role === "id" || field.role === "target") return nameOf(stmt, field.slot) === "";
  const value = valueOf(stmt, field);
  return value !== undefined && [...allExprs(value)].some(isEmptyExpr);
}

/**
 * The field that takes the keyboard when the editor opens: the slot clicked on the node (the
 * item holding the input clicked, when one was), else the first field still to fill, else none.
 */
export function startField(
  stmt: Stmt,
  fields: readonly Field[],
  clicked: { slot: string | null; hole: NodeId | null },
): Field | null {
  const { slot, hole } = clicked;
  if (slot === null) return fields.find((field) => toFill(stmt, field)) ?? null;
  const inSlot = fields.filter((field) => field.slot === slot);
  const holding =
    hole === null
      ? undefined
      : inSlot.find((field) => {
          const value = valueOf(stmt, field);
          return value !== undefined && find(value, hole) !== undefined;
        });
  return holding ?? inSlot[0] ?? null;
}
