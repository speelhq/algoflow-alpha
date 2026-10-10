// C-14: every challenge file is bundled; C-16: the list follows the plans; C-25: every
// challenge is in one plan.
import { describe, expect, it, vi } from "vitest";
import { CHALLENGES, getChallenge, PLANS, planOf } from "./index";

describe("challenge bundle (C-14, C-16, C-25)", () => {
  it("loads every challenges/*.json with id, tests, and solution; plans.json is not one", () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(5);
    for (const challenge of CHALLENGES) {
      expect(challenge.tests.length).toBeGreaterThanOrEqual(3);
      expect(challenge.solution.challengeId).toBe(challenge.id);
      expect(challenge.difficulty).toMatch(/^(easy|medium|hard)$/);
      expect(challenge.topics.length).toBeGreaterThan(0);
    }
    expect(CHALLENGES.some((c) => c.id === "plans")).toBe(false);
  });

  it("C-16: lists each plan's members in its order, the plans in theirs", () => {
    expect(CHALLENGES.map((c) => c.id)).toEqual(PLANS.flatMap((plan) => plan.problems));
  });

  it("C-25: finds the one plan of each challenge; an id in no plan throws", () => {
    for (const plan of PLANS) for (const id of plan.problems) expect(planOf(id)).toBe(plan);
    expect(() => planOf("nope")).toThrow('challenge "nope" is in no plan');
  });

  it("a plan member with no file fails the bundle at load", async () => {
    vi.resetModules();
    vi.doMock("../../challenges/plans.json", () => ({
      default: [{ id: "p", title: { en: "P" }, description: { en: "D" }, problems: ["nope"] }],
    }));
    try {
      await expect(import("./index")).rejects.toThrow('plan "p" lists "nope", which has no file');
    } finally {
      vi.doUnmock("../../challenges/plans.json");
      vi.resetModules();
    }
  });

  it("looks up by id", () => {
    expect(getChallenge("fizzbuzz")?.title.en).toBe("FizzBuzz");
    expect(getChallenge("nope")).toBeUndefined();
    expect(getChallenge(undefined)).toBeUndefined();
  });
});
