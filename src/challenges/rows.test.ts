// The rows of one case; the first difference and the step Watch this case opens at.
import { describe, expect, it } from "vitest";
import { firstDifference, resultRows, watchStep } from "./rows";

describe("resultRows", () => {
  it("aligns Output and Expected line by line, with a blank cell where one side has no line", () => {
    const short = resultRows({ stdout: ["1", "2", "Fizz"] }, { stdout: ["1", "2"], vars: {} });
    expect(short.output).toEqual([
      { line: 1, actual: "1", expected: "1", differs: false },
      { line: 2, actual: "2", expected: "2", differs: false },
      { line: 3, expected: "Fizz", differs: true },
    ]);
    const long = resultRows({ stdout: ["1"] }, { stdout: ["1", ""], vars: {} });
    expect(long.output[1]).toEqual({ line: 2, actual: "", differs: true });
  });

  it("shows every expected variable, blank when the program never created it", () => {
    const rows = resultRows(
      { variables: { total: 55, ratio: 0.5, best: null } },
      { stdout: [], vars: { sum_all: 55, ratio: 0.5000000004, best: null } },
    );
    expect(rows.variables).toEqual([
      { name: "total", expected: 55, differs: true },
      { name: "ratio", expected: 0.5, actual: 0.5000000004, differs: false }, // within 1e-6
      { name: "best", expected: null, actual: null, differs: false },
    ]);
    expect(rows.output).toEqual([]);
  });

  it("a case with no expectation has output rows only, and none differs", () => {
    const rows = resultRows(undefined, { stdout: ["a"], vars: { x: 1 } });
    expect(rows).toEqual({ output: [{ line: 1, actual: "a", differs: false }], variables: [] });
    expect(firstDifference(rows)).toBeNull();
  });
});

describe("firstDifference and watchStep", () => {
  it("the first output row that differs, or else the first variable row that differs", () => {
    const both = resultRows(
      { stdout: ["1", "2"], variables: { a: 1, b: 2 } },
      { stdout: ["1", "x"], vars: { a: 0, b: 0 } },
    );
    expect(firstDifference(both)).toEqual({ kind: "output", line: 2 });
    const variable = resultRows(
      { stdout: ["1"], variables: { a: 1, b: 2 } },
      { stdout: ["1"], vars: { a: 1, b: 0 } },
    );
    expect(firstDifference(variable)).toEqual({ kind: "variable", name: "b" });
  });

  it("opens at the print of the differing line, else at the last step of the run", () => {
    const prints = [4, 7, 10];
    expect(watchStep({ kind: "output", line: 2 }, prints, 12)).toEqual({ step: 7, line: 2 });
    expect(watchStep({ kind: "output", line: 3 }, prints, 10)).toEqual({ step: 10, line: 3 });
    expect(watchStep({ kind: "output", line: 4 }, prints, 12)).toEqual({ step: 12 }); // never printed
    expect(watchStep({ kind: "variable", name: "total" }, prints, 12)).toEqual({ step: 12 });
    expect(watchStep(null, prints, 12)).toEqual({ step: 12 });
  });
});
