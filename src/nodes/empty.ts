// The placeholder in an unfilled required slot. Never in the block menu;
// validate reports E_EMPTY_SLOT before anything runs.
import { newId } from "@/lang/id";
import type { Expr, Value } from "@/lang/types";
import type { Event } from "@/runtime/types";
import { defineExpr } from "./types";

/** A new unfilled slot: what every block's `create()` and the editor put in an input to fill. */
export function emptyExpr(): Extract<Expr, { kind: "empty" }> {
  return { id: newId(), kind: "empty" };
}

export const empty = defineExpr<"empty">({
  key: "empty",
  category: "basic",
  hidden: true,
  slots: [],
  create: emptyExpr,
  run(node): Generator<Event, Value, void> {
    throw new Error(`empty slot ${node.id} cannot run`);
  },
  python: () => "...",
});
