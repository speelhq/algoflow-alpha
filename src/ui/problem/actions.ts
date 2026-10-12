// The page's Run. With diagnostics present it does not start: it selects the
// first diagnostic's statement and shows its message. Run acts on the learner's
// program, so a shown solution gives way to the learner's chart first. The play button's action,
// and what a click on a node does in each mode.
import { validate } from "@/lang/validate";
import type { NodeId } from "@/lang/types";
import { ownerStmts } from "@/lang/walk";
import { useEditor } from "@/store/editor";
import { currentMode } from "@/store/mode";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { useTests } from "@/store/tests";

/** True when the program has no diagnostic; otherwise leads to the first one. */
function readyToRun(): boolean {
  const program = useProgram.getState().program;
  const editor = useEditor.getState();
  editor.showSolution(false);
  const [first] = validate(program);
  if (!first) return true;
  editor.lead(ownerStmts(program).get(first.nodeId) ?? first.nodeId, first);
  return false;
}

export function startRun(opts?: { watch?: boolean }): void {
  if (!readyToRun()) return;
  useTests.getState().reset();
  useEditor.getState().setTab("result");
  void useRun.getState().run(opts);
}

/** `Replay` at the run's last step: back to step 0, playing. */
function replay(): void {
  void useRun
    .getState()
    .seek(0)
    .then(() => useRun.getState().play());
}

/**
 * The play button, also Ctrl/Cmd+Enter: `Run`, `Pause`, `Play`, or `Replay` at the run's last
 * step; nothing during the pre-run, where the button is disabled.
 */
export function togglePlay(): void {
  const run = useRun.getState();
  switch (run.status) {
    case "idle":
      if (!run.busy) startRun();
      return;
    case "playing":
      run.pause();
      return;
    case "paused":
      run.play();
      return;
    case "done":
    case "error":
      replay();
      return;
  }
}

/** Submit judges every test on its own runner and selects `Result`. */
export function startSubmit(): void {
  if (!readyToRun()) return;
  useEditor.getState().setTab("result");
  void useTests.getState().submit();
}

/**
 * A click on a statement's node, with the slot and the input clicked: while running it sets or
 * clears the breakpoint, pausing first; once the run has ended it returns to build mode and
 * selects; in build mode it selects; on the shown solution it does nothing.
 */
export function clickNode(owner: NodeId, slot?: string, hole?: NodeId): void {
  const run = useRun.getState();
  switch (currentMode()) {
    case "running":
      if (run.status === "playing") run.pause();
      run.setBreakpoint(run.breakpoint === owner ? null : owner);
      return;
    case "solution":
      return;
    case "ended":
      run.stop();
      break;
    case "build":
      break;
  }
  useEditor.getState().select(owner, slot, true, hole);
}
