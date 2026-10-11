// What the page is doing, from the driver's status and the editor's solution flag: building the
// learner's program, showing the solution, running it, or showing a run that has ended. Every
// check of what the page allows reads it; the driver keeps its own `status`.
import { useEditor } from "./editor";
import { useRun, type Status } from "./run";

export type Mode = "build" | "solution" | "running" | "ended";

export function modeOf(status: Status, solution: boolean): Mode {
  if (status === "done" || status === "error") return "ended";
  if (status !== "idle") return "running";
  return solution ? "solution" : "build";
}

/** The learner's program can be edited: only in build mode. */
export function editable(mode: Mode): boolean {
  return mode === "build";
}

/** The page is in run mode: a run is on the chart, still going or ended. */
export function inRun(mode: Mode): boolean {
  return mode === "running" || mode === "ended";
}

export function useMode(): Mode {
  const status = useRun((s) => s.status);
  const solution = useEditor((s) => s.solution);
  return modeOf(status, solution);
}

export function currentMode(): Mode {
  return modeOf(useRun.getState().status, useEditor.getState().solution);
}
