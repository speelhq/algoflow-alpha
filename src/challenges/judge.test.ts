// Equality per expectation kind; a runtime error fails the test.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { finish, outcomeOf, type Outcome } from "@/runtime/outcome";
import { run } from "@/runtime/run";
import type { Program } from "@/lang/types";
import { judge } from "./judge";
import type { Test } from "./types";

const { assign, num, float, bin, v, print, str } = ast;

function outcome(p: Program, inputs = {}): Outcome {
  const runner = run(p, inputs, 1);
  return outcomeOf(runner, finish(runner));
}

const test = (expected: Test["expect"], inputs = {}): Test => ({ inputs, expect: expected });

describe("judge", () => {
  it("passes when every expected variable and stdout line matches", () => {
    const out = outcome(program([assign("total", num(55)), print(str("done"))]));
    expect(judge(test({ variables: { total: 55 }, stdout: ["done"] }), out)).toEqual({
      status: "pass",
    });
  });

  it("compares floats within 1e-6 and ints exactly", () => {
    const out = outcome(program([assign("x", float(14.0030000001)), assign("n", num(3))]));
    expect(judge(test({ variables: { x: 14.003 } }), out).status).toBe("pass");
    expect(judge(test({ variables: { n: 4 } }), out)).toEqual({
      status: "fail",
      rows: { output: [], variables: [{ name: "n", expected: 4, actual: 3, differs: true }] },
    });
  });

  it("reports a variable that was never assigned with no actual value", () => {
    const out = outcome(program([assign("a", num(1))]));
    expect(judge(test({ variables: { b: 1 } }), out)).toEqual({
      status: "fail",
      rows: { output: [], variables: [{ name: "b", expected: 1, differs: true }] },
    });
  });

  it("compares stdout line by line", () => {
    const out = outcome(program([print(num(1)), print(num(2))]));
    expect(judge(test({ stdout: ["1", "2"] }), out).status).toBe("pass");
    expect(judge(test({ stdout: ["1"] }), out)).toEqual({
      status: "fail",
      rows: {
        output: [
          { line: 1, actual: "1", expected: "1", differs: false },
          { line: 2, actual: "2", differs: true },
        ],
        variables: [],
      },
    });
  });

  it("a runtime error fails the test with the error", () => {
    const div = bin("/", num(1), num(0));
    const out = outcome(program([assign("x", div)]));
    expect(judge(test({ variables: { x: 1 } }), out)).toEqual({
      status: "error",
      error: { nodeId: div.id, code: "E_DIV_ZERO", params: {} },
    });
  });

  it("uses the test inputs", () => {
    const p = program([assign("y", bin("*", v("n"), num(2)))], {
      inputs: [{ name: "n", kind: "number" }],
    });
    expect(judge(test({ variables: { y: 10 } }, { n: 5 }), outcome(p, { n: 5 })).status).toBe(
      "pass",
    );
  });
});
