// The page's keyboard table: Ctrl/Cmd+Enter is the play button; in run mode → steps, ← goes
// back, Ctrl/Cmd+→ skips; Esc clears the breakpoint while running, else stops a run, else clears
// the selection; Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo, Ctrl/Cmd+D duplicates the
// selected node, and Delete and Backspace remove it. Shift+→ (Step over) is not bound: the
// driver has no Step over. A key goes to the page only when nothing focused owns it.
import { useEffect } from "react";
import { duplicateStmt, removeStmt } from "@/lang/edit";
import { useEditor } from "@/store/editor";
import { currentMode, editable, inRun } from "@/store/mode";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { apply } from "@/ui/editor/edits";
import { lineTakes } from "@/ui/editor/line";
import { togglePlay } from "./actions";

const REMOVE = new Set(["Delete", "Backspace"]);

/**
 * Whether the focused element owns a key: a field or a slider every key, a value line the keys
 * it takes, and an open editor or menu Delete and Backspace.
 */
export function ownsKeys(
  event: Pick<KeyboardEvent, "target" | "key" | "ctrlKey" | "metaKey" | "getModifierState">,
): boolean {
  const { target } = event;
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, [contenteditable], [role=slider]") !== null) {
    return true;
  }
  if (target.closest("[data-value-line]") !== null && lineTakes(event)) return true;
  return REMOVE.has(event.key) && target.closest('[role="dialog"], [role="menu"]') !== null;
}

/** Acts on a key the page owns; false when the table has nothing for it. */
function act(event: KeyboardEvent): boolean {
  const mod = event.ctrlKey || event.metaKey;
  const mode = currentMode();
  const run = useRun.getState();
  const selected = useEditor.getState().selectedId;
  if (mod && event.key === "Enter") togglePlay();
  else if (mod && event.key.toLowerCase() === "z") {
    if (editable(mode)) {
      if (event.shiftKey) useProgram.getState().redo();
      else useProgram.getState().undo();
    }
  } else if (mod && event.key.toLowerCase() === "d" && selected) {
    apply((program) => duplicateStmt(program, selected));
  } else if (!mod && REMOVE.has(event.key) && selected) {
    if (apply((program) => removeStmt(program, selected))) useEditor.getState().select(null);
  } else if (inRun(mode) && mod && event.key === "ArrowRight") void run.skip();
  else if (inRun(mode) && !mod && !event.shiftKey && event.key === "ArrowRight") run.stepOnce();
  else if (inRun(mode) && !mod && event.key === "ArrowLeft") void run.back();
  else if (event.key === "Escape") {
    if (!inRun(mode)) useEditor.getState().select(null);
    else if (mode === "running" && run.breakpoint !== null) run.setBreakpoint(null);
    else run.stop();
  } else return false;
  return true;
}

/** The keyboard table, once per page. */
export function usePageKeys(): void {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || ownsKeys(event)) return;
      if (act(event)) event.preventDefault();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
}
