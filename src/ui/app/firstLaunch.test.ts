// A load at the Problems route with no stored work opens the first plan's first problem.
import { describe, expect, it } from "vitest";
import { PLANS } from "@/challenges";
import { firstLaunchTarget } from "./firstLaunch";

describe("first launch", () => {
  it("opens the first problem of the first plan when nothing is stored", () => {
    for (const hash of ["", "#", "#/"]) {
      expect(firstLaunchTarget(hash, [], PLANS)).toBe("#/p/tutorial");
    }
  });

  it("ignores the layout key, which records no work", () => {
    expect(firstLaunchTarget("#/", ["algoflow:layout"], PLANS)).toBe("#/p/tutorial");
  });

  it("keeps the Problems page once progress or a program is stored", () => {
    expect(firstLaunchTarget("#/", ["algoflow:progress"], PLANS)).toBeNull();
    expect(firstLaunchTarget("#/", ["algoflow:program:fizzbuzz"], PLANS)).toBeNull();
  });

  it("keeps any other route, including one that falls back to Problems", () => {
    expect(firstLaunchTarget("#/p/fizzbuzz", [], PLANS)).toBeNull();
    expect(firstLaunchTarget("#/play", [], PLANS)).toBeNull();
    expect(firstLaunchTarget("#/nope", [], PLANS)).toBeNull();
  });

  it("keeps the Problems page when there is no plan", () => {
    expect(firstLaunchTarget("#/", [], [])).toBeNull();
  });
});
