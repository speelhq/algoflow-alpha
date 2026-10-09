import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { call, num, float, str } = ast;

describe("builtin min (nodes.md)", () => {
  it("N-03: emits `min(<a>, <b>)`", () => {
    expect(unparse(call("min", num(2), num(3)))).toBe("min(2, 3)");
  });

  it("N-10: the smaller value, keeping its type; strings compare lexicographically", () => {
    expect(evalExpr(call("min", num(2), float(3))).value).toEqual({ t: "int", v: 2 });
    expect(evalExpr(call("min", float(1.5), num(2))).value).toEqual({ t: "float", v: 1.5 });
    expect(evalExpr(call("min", str("b"), str("a"))).data).toBe("a");
  });

  it("N-10: a number and a string → E_TYPE (L-15)", () => {
    expect(evalExpr(call("min", num(1), str("a"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });
});
