import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { call, num, float, str } = ast;

describe("builtin max (nodes.md)", () => {
  it("N-03: emits `max(<a>, <b>)`", () => {
    expect(unparse(call("max", num(2), num(3)))).toBe("max(2, 3)");
  });

  it("N-10: the larger value, keeping its type", () => {
    expect(evalExpr(call("max", num(2), float(3))).value).toEqual({ t: "float", v: 3 });
    expect(evalExpr(call("max", num(9), num(4))).data).toBe(9);
    expect(evalExpr(call("max", str("b"), str("a"))).data).toBe("b");
  });

  it("N-10: a number and a string → E_TYPE (L-15)", () => {
    expect(evalExpr(call("max", str("a"), num(1))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });
});
