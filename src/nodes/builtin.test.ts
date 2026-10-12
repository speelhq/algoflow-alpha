// A builtin's parameters give the argument counts it takes, `optional` marking the ones it may go
// without; a new builtin holds an empty argument per required parameter.
import { describe, expect, it } from "vitest";
import type { Expr, Value } from "@/lang/types";
import { defineBuiltin } from "./builtin";
import { expectedArgs, type ExprRunner, type RunContext } from "./types";

const one: Value = { t: "int", v: 1 };
const probe = defineBuiltin({
  name: "probe",
  category: "basic",
  params: [{ name: "x" }, { name: "n", optional: true }],
  evaluate: (args) => args[0] ?? one,
});
const ctx = {
  *eval() {
    return one;
  },
} as unknown as RunContext;

function call(argc: number): Extract<Expr, { kind: "call" }> {
  const args = Array.from({ length: argc }, (_, i): Expr => ({
    id: `arg00000000${i}`,
    kind: "num",
    value: 1,
    float: false,
    raw: "1",
  }));
  return { id: "call00000001", kind: "call", fn: "probe", args };
}

function run(argc: number): Value {
  const steps = (probe.run as ExprRunner)(call(argc), ctx);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

describe("builtin argument counts", () => {
  it("a count outside the parameters expects the fewest when too few, the most when too many", () => {
    const params = probe.params ?? [];
    expect(expectedArgs(params, 0)).toBe(1);
    expect(expectedArgs(params, 1)).toBeUndefined();
    expect(expectedArgs(params, 2)).toBeUndefined();
    expect(expectedArgs(params, 3)).toBe(2);
    expect(expectedArgs([{ name: "a" }, { name: "b" }], 1)).toBe(2);
  });

  it("the runner takes every count the parameters take, the rule validation applies", () => {
    expect(run(1)).toEqual(one);
    expect(run(2)).toEqual(one);
    expect(() => run(0)).toThrow("probe takes 1 arguments, given 0");
    expect(() => run(3)).toThrow("probe takes 2 arguments, given 3");
  });

  it("a new builtin holds one empty argument per parameter not marked optional", () => {
    expect(probe.create()).toMatchObject({ kind: "call", fn: "probe", args: [{ kind: "empty" }] });
  });
});
