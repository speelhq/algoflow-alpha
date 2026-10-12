// @vitest-environment jsdom
// Opening a program loads it, chooses the first case, and discards any run; the page opens on its
// first tab with nothing selected.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChallenge } from "@/challenges";
import { useEditor } from "./editor";
import { openProgram } from "./open";
import { createPlaygroundProgram, emptyProgram, useProgram } from "./program";
import { useRun } from "./run";
import { settle } from "./testing";

describe("openProgram", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    useRun.getState().stop();
    vi.useRealTimers();
  });

  it("a problem opens at its first case with no run, on the Problem tab", async () => {
    openProgram("fizzbuzz");
    const challenge = getChallenge("fizzbuzz");
    if (!challenge) throw new Error("fizzbuzz missing");
    useProgram.getState().edit(challenge.solution);
    useRun.getState().selectCase(1);
    await settle(useRun.getState().run());
    useEditor.getState().setTab("python");
    useEditor.getState().select(useProgram.getState().program.main[0]?.id ?? null);
    useEditor.getState().showSolution(true);
    expect(useRun.getState()).toMatchObject({ status: "playing", caseIndex: 1 });

    openProgram("fizzbuzz");
    expect(useProgram.getState()).toMatchObject({
      id: "fizzbuzz",
      program: { main: challenge.solution.main },
      past: [],
    });
    expect(useRun.getState()).toMatchObject({ status: "idle", caseIndex: 0 });
    expect(useEditor.getState()).toMatchObject({
      tab: "problem",
      selectedId: null,
      solution: false,
    });
  });

  it("a Playground program opens on the Result tab", () => {
    const id = createPlaygroundProgram(emptyProgram("Mine"));
    openProgram(id);
    expect(useProgram.getState()).toMatchObject({ id, program: { title: "Mine" } });
    expect(useEditor.getState().tab).toBe("result");
  });
});
