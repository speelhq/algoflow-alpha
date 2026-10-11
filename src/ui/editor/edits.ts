// Every edit the page makes goes through `apply`: only in build mode on the learner's own
// chart, as one history entry (or one per typed field), selecting what it creates.
import { EditError, insertStmt } from "@/lang/edit";
import type { Place, Program, Stmt } from "@/lang/types";
import { useEditor } from "@/store/editor";
import { currentMode, editable } from "@/store/mode";
import { useProgram } from "@/store/program";

/** Applies `change` to the program; false when editing is disabled or the edit does not apply. */
export function apply(change: (program: Program) => Program, field?: string): boolean {
  if (!editable(currentMode())) return false;
  const store = useProgram.getState();
  try {
    store.edit(change(store.program), field);
    return true;
  } catch (error) {
    if (error instanceof EditError) return false;
    throw error;
  }
}

/** Inserts a block at a connector's place and opens its editor. */
export function insertBlock(stmt: Stmt, place: Place): void {
  if (apply((program) => insertStmt(program, stmt, place))) useEditor.getState().select(stmt.id);
}
