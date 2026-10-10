import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { call, num, float, str, neg } = ast;

describe("builtin abs (nodes.md)", () => {
  it("N-03: emits `abs(<x>)`", () => {
    expect(unparse(call("abs", neg(num(3))))).toBe("abs(-3)");
  });

  it("N-10: absolute value keeps int/float", () => {
    expect(evalExpr(call("abs", neg(num(3)))).value).toEqual({ t: "int", v: 3 });
    expect(evalExpr(call("abs", float(-2.5))).value).toEqual({ t: "float", v: 2.5 });
  });

  it("N-10 / R-34: a non-number → E_VALUE naming abs and the type", () => {
    const e = call("abs", str("a"));
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_VALUE", params: { op: "call:abs", type: "str" } },
    });
  });
});
