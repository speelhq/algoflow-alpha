import { describe, expect, it } from "vitest";
import { emit, unparse } from "@/python/emit";
import { ast, evalExpr, program, runAll, varData } from "./testing";

const { call, num, float, str, assign, for_ } = ast;

describe("builtin random_int (nodes.md)", () => {
  it("emits `random.randint(<a>, <b>)` and adds `import random`", () => {
    expect(unparse(call("random_int", num(1), num(6)))).toBe("random.randint(1, 6)");
    expect(emit(program([assign("d", call("random_int", num(1), num(6)))]), {}).code).toBe(
      "import random\n\nd = random.randint(1, 6)\n",
    );
  });

  it("inclusive int draws, recorded in draws(), identical for the same seed", () => {
    const prog = program([
      for_("i", num(0), num(50), [assign("d", call("random_int", num(1), num(3)))]),
    ]);
    const a = runAll(prog, {}, 7);
    const b = runAll(prog, {}, 7);
    expect(a.draws).toHaveLength(50);
    expect(a.draws.every((d) => Number.isInteger(d) && d >= 1 && d <= 3)).toBe(true);
    expect(new Set(a.draws).size).toBe(3);
    expect(a.draws).toEqual(b.draws);
    expect(varData(a, "d")).toBe(a.draws[49]);
    expect(runAll(prog, {}, 8).draws).not.toEqual(a.draws);
  });

  it("a bound that is no int → E_TYPE, naming the types of both bounds", () => {
    expect(evalExpr(call("random_int", float(1), num(2))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "float", right: "int" } },
    });
    expect(evalExpr(call("random_int", num(1), str("2"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "int", right: "str" } },
    });
  });

  it("random_int(5, 1) → E_EMPTY_RANGE, as CPython's empty range", () => {
    expect(evalExpr(call("random_int", num(5), num(1))).done).toMatchObject({
      type: "error",
      error: { code: "E_EMPTY_RANGE", params: { a: 5, b: 1 } },
    });
  });
});
