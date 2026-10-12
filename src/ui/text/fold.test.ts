// More than eight lines fold to the first five and `… n more`.
import { describe, expect, it } from "vitest";
import { foldLines } from "./fold";

describe("foldLines", () => {
  it("keeps up to eight lines whole", () => {
    const eight = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect(foldLines(eight)).toEqual({ shown: eight, more: 0 });
    expect(foldLines([])).toEqual({ shown: [], more: 0 });
  });

  it("folds nine or more to the first five", () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => String(i + 1));
    expect(foldLines(fifteen)).toEqual({ shown: ["1", "2", "3", "4", "5"], more: 10 });
  });
});
