// @vitest-environment jsdom
// C-13: opening a problem; L-52: history; L-53, L-55, L-67: storage; L-57: Playground programs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Challenge } from "@/challenges/types";
import type { Program } from "@/lang/types";
import { ast, program } from "@/nodes/testing";
import { isPlaygroundId, PLAYGROUND_KEY, playgroundRows, readIndex } from "./playground";
import {
  createPlaygroundProgram,
  deletePlaygroundProgram,
  emptyProgram,
  flushSave,
  HISTORY,
  programKey,
  restore,
  SAVE_DELAY,
  storedTitle,
  useProgram,
} from "./program";

const { assign, num, print, v } = ast;

const bare: Challenge = {
  id: "bare",
  title: { en: "Bare" },
  difficulty: "easy",
  topics: ["output"],
  description: { en: "" },
  inputs: [{ name: "m", kind: "number" }],
  tests: [],
  hints: [],
  solution: program([assign("x", num(0))]),
};

vi.mock("@/challenges", () => ({
  getChallenge: (id: string | undefined) => [bare].find((challenge) => challenge.id === id),
}));

const stored = (id: string): unknown => JSON.parse(localStorage.getItem(programKey(id)) ?? "null");
const withMain = (p: Program, main: Program["main"]): Program => ({ ...p, main });

describe("program store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    flushSave();
    vi.useRealTimers();
  });

  it("C-13: creates an empty main when nothing is stored, with challengeId and inputs set", () => {
    expect(restore("bare")).toEqual({
      ...emptyProgram(),
      challengeId: "bare",
      inputs: [{ name: "m", kind: "number" }],
    });
  });

  it("L-55, L-67: restores the stored program and lets the challenge overwrite challengeId and inputs", () => {
    const saved = {
      ...program([print(v("m"))], { inputs: [{ name: "m", kind: "text" }] }),
      title: "Mine",
    };
    localStorage.setItem(programKey("bare"), JSON.stringify(saved));
    const p = restore("bare");
    expect(p.title).toBe("Mine");
    expect(p.main).toEqual(saved.main);
    expect(p.challengeId).toBe("bare");
    expect(p.inputs).toEqual([{ name: "m", kind: "number" }]);
  });

  it("L-55: ignores a stored value that migrate() rejects", () => {
    localStorage.setItem(programKey("bare"), "{not json");
    expect(restore("bare").main).toEqual([]);
    localStorage.setItem(programKey("bare"), JSON.stringify({ version: 2 }));
    expect(restore("bare").main).toEqual([]);
    localStorage.setItem(programKey("bare"), JSON.stringify({ version: 1, main: [{}] }));
    expect(restore("bare").main).toEqual([]);
  });

  it("L-67: a Playground program restores without challengeId or inputs", () => {
    const saved = {
      ...program([assign("k", num(2))], { inputs: [{ name: "n", kind: "number" }] }),
      challengeId: "stale",
    };
    localStorage.setItem(programKey("play-abcdefghijkl"), JSON.stringify(saved));
    const p = restore("play-abcdefghijkl");
    expect(p.main).toEqual(saved.main);
    expect(p.challengeId).toBeUndefined();
    expect(p.inputs).toEqual([]);
  });

  it("C-13: load() swaps the program and starts an empty history", () => {
    const store = useProgram.getState();
    store.load("bare");
    store.edit(withMain(useProgram.getState().program, [print(num(1))]));
    expect(useProgram.getState().past).toHaveLength(1);
    useProgram.getState().load("bare");
    expect(useProgram.getState()).toMatchObject({ id: "bare", past: [], future: [] });
    expect(useProgram.getState().program.challengeId).toBe("bare");
  });

  it("L-52: undo and redo walk the history", () => {
    useProgram.getState().load("bare");
    const opened = useProgram.getState().program;
    const one = withMain(opened, [print(num(1))]);
    const two = withMain(opened, [print(num(2))]);
    useProgram.getState().edit(one);
    useProgram.getState().edit(two);
    useProgram.getState().undo();
    expect(useProgram.getState().program).toBe(one);
    useProgram.getState().undo();
    expect(useProgram.getState().program).toBe(opened);
    useProgram.getState().undo();
    expect(useProgram.getState().program).toBe(opened);
    useProgram.getState().redo();
    useProgram.getState().redo();
    expect(useProgram.getState().program).toBe(two);
    useProgram.getState().undo();
    useProgram.getState().edit(withMain(opened, [print(num(3))]));
    expect(useProgram.getState().future).toEqual([]);
  });

  it("L-52: an edit that changes nothing is no history entry", () => {
    useProgram.getState().load("bare");
    useProgram.getState().edit(structuredClone(useProgram.getState().program));
    expect(useProgram.getState().past).toEqual([]);
  });

  it("L-52: history keeps the last 100 programs", () => {
    useProgram.getState().load("bare");
    for (let i = 0; i <= HISTORY; i += 1) {
      useProgram.getState().edit(withMain(useProgram.getState().program, [print(num(i))]));
    }
    expect(useProgram.getState().past).toHaveLength(HISTORY);
  });

  it("L-52: consecutive changes typed into one field form one entry", () => {
    useProgram.getState().load("bare");
    const opened = useProgram.getState().program;
    useProgram.getState().edit(withMain(opened, [print(num(1))]), "node:value");
    useProgram.getState().edit(withMain(opened, [print(num(12))]), "node:value");
    useProgram.getState().edit(withMain(opened, [print(num(123))]), "node:value");
    expect(useProgram.getState().past).toEqual([opened]);
    useProgram.getState().edit(withMain(opened, [print(num(4))]), "other:value");
    expect(useProgram.getState().past).toHaveLength(2);
    useProgram.getState().undo();
    useProgram.getState().undo();
    expect(useProgram.getState().program).toBe(opened);
  });

  it("L-53: an edit is saved 500 ms after the last edit, and opening alone saves nothing", () => {
    useProgram.getState().load("bare");
    expect(stored("bare")).toBeNull();
    const next = withMain(useProgram.getState().program, [print(num(1))]);
    useProgram.getState().edit(next);
    vi.advanceTimersByTime(SAVE_DELAY - 1);
    expect(stored("bare")).toBeNull();
    vi.advanceTimersByTime(1);
    expect(stored("bare")).toEqual(next);
  });

  it("L-53: hiding the page saves at once, and opening another program saves the pending edit", () => {
    useProgram.getState().load("bare");
    const next = withMain(useProgram.getState().program, [print(num(1))]);
    useProgram.getState().edit(next);
    window.dispatchEvent(new Event("pagehide"));
    expect(stored("bare")).toEqual(next);
    localStorage.clear();
    useProgram.getState().edit(withMain(next, [print(num(2))]));
    useProgram.getState().load("play-abcdefghijkl");
    expect(stored("bare")).toMatchObject({ main: [{ kind: "print" }] });
  });

  it("L-57: a Playground program has a play- id, and its saves are indexed by time", () => {
    vi.setSystemTime(1000);
    const id = createPlaygroundProgram({ ...emptyProgram("Mine"), challengeId: "bare" });
    expect(isPlaygroundId(id)).toBe(true);
    expect(id).toMatch(/^play-[A-Za-z0-9_-]{12}$/);
    expect(readIndex()).toEqual({ [id]: { edited: 1000 } });
    expect(stored(id)).toEqual(emptyProgram("Mine"));

    useProgram.getState().load(id);
    vi.setSystemTime(5000);
    useProgram.getState().edit({ ...useProgram.getState().program, title: "Renamed" });
    vi.advanceTimersByTime(SAVE_DELAY);
    expect(readIndex()[id]?.edited).toBe(5000 + SAVE_DELAY);
    expect(storedTitle(id)).toBe("Renamed");
    expect(playgroundRows(storedTitle)).toEqual([
      { id, title: "Renamed", edited: 5000 + SAVE_DELAY },
    ]);

    deletePlaygroundProgram(id);
    expect(readIndex()).toEqual({});
    expect(stored(id)).toBeNull();
    expect(localStorage.getItem(PLAYGROUND_KEY)).toBe("{}");
  });

  it("L-57: rows are ordered by last edit, the latest first", () => {
    localStorage.setItem(
      PLAYGROUND_KEY,
      JSON.stringify({ "play-a": { edited: 1 }, "play-b": { edited: 3 }, "play-c": { edited: 2 } }),
    );
    const rows = playgroundRows((id) => id);
    expect(rows.map((row) => row.id)).toEqual(["play-b", "play-c", "play-a"]);
  });
});
