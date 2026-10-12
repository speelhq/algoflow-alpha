// The page's mode, from the driver's status and the shown solution.
import { describe, expect, it } from "vitest";
import { editable, inRun, modeOf, type Mode } from "./mode";

const MODES: Mode[] = ["build", "solution", "running", "ended"];

describe("modeOf", () => {
  it("is build or solution while idle, running before the end, and ended at it", () => {
    expect(modeOf("idle", false)).toBe("build");
    expect(modeOf("idle", true)).toBe("solution");
    expect(modeOf("playing", false)).toBe("running");
    expect(modeOf("paused", false)).toBe("running");
    expect(modeOf("done", false)).toBe("ended");
    expect(modeOf("error", false)).toBe("ended");
  });

  it("only build mode edits; running and ended are run mode", () => {
    expect(MODES.map(editable)).toEqual([true, false, false, false]);
    expect(MODES.map(inRun)).toEqual([false, false, true, true]);
  });
});
