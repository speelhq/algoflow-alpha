// U-99: `Start` / `Continue` / no button; U-83: `Next problem →` and `Plan complete`.
import { describe, expect, it } from "vitest";
import { planOf } from "./index";
import { nextProblem, planAction, type Status } from "./next";

const course = ["tutorial", "sum-to-n", "fizzbuzz", "max-of-three", "countdown"];

function statuses(entries: Record<string, "attempted" | "solved">): Status {
  return (id) => entries[id];
}

describe("planAction (U-99)", () => {
  it("offers Start on the first problem while no problem has an entry", () => {
    expect(planAction(course, statuses({}))).toEqual({ kind: "start", id: "tutorial" });
  });

  it("offers Continue on the first unsolved problem once any has an entry", () => {
    const status = statuses({ tutorial: "solved", "sum-to-n": "attempted" });
    expect(planAction(course, status)).toEqual({ kind: "continue", id: "sum-to-n" });
    expect(planAction(course, statuses({ "sum-to-n": "solved" }))).toEqual({
      kind: "continue",
      id: "tutorial",
    });
  });

  it("offers nothing once every problem is solved, or for an empty plan", () => {
    const all = statuses(Object.fromEntries(course.map((id) => [id, "solved" as const])));
    expect(planAction(course, all)).toBeNull();
    expect(planAction([], statuses({}))).toBeNull();
  });
});

describe("nextProblem (U-83)", () => {
  it("walks the course plan, as these cases assume", () => {
    expect(planOf("tutorial").problems).toEqual(course);
  });

  it("leads to the next unsolved problem of the plan", () => {
    const status = statuses({ tutorial: "solved", "sum-to-n": "solved", fizzbuzz: "solved" });
    expect(nextProblem("sum-to-n", status)).toEqual({ kind: "next", id: "max-of-three" });
  });

  it("wraps round to an earlier unsolved problem", () => {
    const status = statuses({ "max-of-three": "solved", countdown: "solved" });
    expect(nextProblem("countdown", status)).toEqual({ kind: "next", id: "tutorial" });
  });

  it("takes the next row once every other problem is solved, and says Plan complete after the last", () => {
    const all = statuses(Object.fromEntries(course.map((id) => [id, "solved" as const])));
    expect(nextProblem("fizzbuzz", all)).toEqual({ kind: "next", id: "max-of-three" });
    expect(nextProblem("countdown", all)).toEqual({ kind: "complete" });
  });
});
