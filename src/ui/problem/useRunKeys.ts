// The keyboard table as far as running goes: Ctrl/Cmd+Enter runs or pauses; while
// running → steps, ← goes back, Ctrl/Cmd+→ skips, and Esc clears the breakpoint, else stops.
// Shift+→ (Step over) is not bound: the driver has no Step over. The editing keys are useEditKeys.
import { useEffect } from "react";
import { useEditor } from "@/store/editor";
import { useRun } from "@/store/run";
import { startRun } from "./actions";

/** Keys typed into a field or a slider belong to it. */
export function ownsKeys(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest("input, textarea, select, [contenteditable], [role=slider], [role=textbox]") !==
    null
  );
}

export function useRunKeys(): void {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || ownsKeys(event.target)) return;
      const run = useRun.getState();
      const mod = event.ctrlKey || event.metaKey;
      const running = run.status !== "idle";
      let handled = true;
      if (mod && event.key === "Enter") {
        // A pause during the pre-run opens the run paused.
        if (run.status === "playing" || (run.status === "idle" && run.busy)) run.pause();
        else if (run.status === "paused") run.play();
        else startRun();
      } else if (running && mod && event.key === "ArrowRight") void run.skip();
      else if (running && !mod && !event.shiftKey && event.key === "ArrowRight") run.stepOnce();
      else if (running && !mod && event.key === "ArrowLeft") void run.back();
      else if (event.key === "Escape") {
        if (!running) useEditor.getState().select(null);
        else if (run.breakpoint !== null && run.status !== "done" && run.status !== "error")
          run.setBreakpoint(null);
        else run.stop();
      } else handled = false;
      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
}
