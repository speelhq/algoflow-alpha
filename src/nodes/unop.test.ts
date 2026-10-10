import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { num, float, str, bin, v, neg, not } = ast;

describe("unop (nodes.md)", () => {
  it("N-03 / E-05: `-x` and `not x` with parentheses where needed", () => {
    expect(unparse(neg(v("x")))).toBe("-x");
    expect(unparse(neg(bin("+", v("a"), v("b"))))).toBe("-(a + b)");
    expect(unparse(neg(bin("**", v("x"), num(2))))).toBe("-x ** 2");
    expect(unparse(bin("**", neg(v("x")), num(2)))).toBe("(-x) ** 2");
    expect(unparse(not(bin("==", v("a"), v("b"))))).toBe("not a == b");
    expect(unparse(not(bin("and", v("a"), v("b"))))).toBe("not (a and b)");
    expect(unparse(bin("and", not(v("a")), v("b")))).toBe("not a and b");
  });

  it("N-10: negation keeps int/float; not yields a bool by truthiness (L-18)", () => {
    expect(evalExpr(neg(num(5))).value).toEqual({ t: "int", v: -5 });
    expect(evalExpr(neg(float(2))).value).toEqual({ t: "float", v: -2 });
    expect(evalExpr(not(num(0))).data).toBe(true);
    expect(evalExpr(not(str("x"))).data).toBe(false);
    expect(evalExpr(not(v("xs")), { xs: [] }).data).toBe(true);
  });

  it("N-10 / R-34: negating a non-number → E_VALUE naming the operation and the type", () => {
    const e = neg(str("a"));
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_VALUE", params: { op: "unop", type: "str" } },
    });
  });
});
