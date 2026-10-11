// The editing keys of the keyboard table: Delete and Backspace remove the selected node,
// Ctrl/Cmd+D duplicates it, and Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo. Esc is the
// run keys' (it also clears the selection). Keys typed into a field belong to the field, and
// Delete and Backspace pressed in an open editor or menu stay there.
import { useEffect } from "react";
import { duplicateStmt, removeStmt } from "@/lang/edit";
import { useEditor } from "@/store/editor";
import { currentMode, editable } from "@/store/mode";
import { useProgram } from "@/store/program";
import { ownsKeys } from "@/ui/problem/useRunKeys";
import { apply } from "./edits";

/** Inside an open editor or menu, Delete and Backspace do not remove the node. */
function inPopup(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[role="dialog"], [role="menu"]') !== null;
}

export function useEditKeys(): void {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || ownsKeys(event)) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const selected = useEditor.getState().selectedId;
      let handled = true;
      if (mod && key === "z") {
        if (editable(currentMode())) {
          if (event.shiftKey) useProgram.getState().redo();
          else useProgram.getState().undo();
        }
      } else if (mod && key === "d" && selected) {
        apply((program) => duplicateStmt(program, selected));
      } else if (
        !mod &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selected &&
        !inPopup(event.target)
      ) {
        if (apply((program) => removeStmt(program, selected))) useEditor.getState().select(null);
      } else handled = false;
      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
}
