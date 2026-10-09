import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { num, float, str, bin, v, neg, bool } = ast;

describe("binop (nodes.md)", () => {
  it("N-03 / E-05: infix with parentheses only where precedence requires", () => {
    expect(unparse(bin("+", v("a"), bin("*", v("b"), v("c"))))).toBe("a + b * c");
    expect(unparse(bin("*", bin("+", v("a"), v("b")), v("c")))).toBe("(a + b) * c");
    expect(unparse(bin("-", v("a"), bin("-", v("b"), v("c"))))).toBe("a - (b - c)");
    expect(unparse(bin("-", bin("-", v("a"), v("b")), v("c")))).toBe("a - b - c");
    expect(unparse(bin("**", bin("**", num(2), num(3)), num(2)))).toBe("(2 ** 3) ** 2");
    expect(unparse(bin("**", num(2), bin("**", num(3), num(2))))).toBe("2 ** 3 ** 2");
    expect(unparse(bin("==", bin("<", v("a"), v("b")), bool(true)))).toBe("(a < b) == True");
    expect(unparse(bin("and", bin("or", v("a"), v("b")), v("c")))).toBe("(a or b) and c");
    expect(unparse(bin("or", v("a"), bin("and", v("b"), v("c"))))).toBe("a or b and c");
    expect(unparse(bin("in", v("x"), v("xs")))).toBe("x in xs");
    expect(unparse(bin("%", v("i"), num(15)))).toBe("i % 15");
    expect(unparse(bin("//", neg(num(7)), num(2)))).toBe("-7 // 2");
  });

  it("N-10 / L-10, L-11: int ∘ int stays int except `/`; any float makes float", () => {
    expect(evalExpr(bin("//", num(7), num(2))).value).toEqual({ t: "int", v: 3 });
    expect(evalExpr(bin("/", num(4), num(2))).value).toEqual({ t: "float", v: 2 });
    expect(evalExpr(bin("+", num(1), float(2))).value).toEqual({ t: "float", v: 3 });
    expect(evalExpr(bin("**", num(2), num(10))).value).toEqual({ t: "int", v: 1024 });
    expect(evalExpr(bin("**", num(2), neg(num(1)))).value).toEqual({ t: "float", v: 0.5 });
  });

  it("N-10 / L-12: `//` floors and `%` takes the divisor's sign", () => {
    expect(evalExpr(bin("//", neg(num(7)), num(2))).data).toBe(-4);
    expect(evalExpr(bin("%", neg(num(7)), num(2))).data).toBe(1);
    expect(evalExpr(bin("%", num(7), neg(num(2)))).data).toBe(-1);
  });

  it("N-10 / L-13: division or modulo by zero → E_DIV_ZERO", () => {
    for (const op of ["/", "//", "%"] as const) {
      const e = bin(op, num(1), num(0));
      expect(evalExpr(e).done).toMatchObject({
        type: "error",
        error: { nodeId: e.id, code: "E_DIV_ZERO" },
      });
    }
  });

  it("N-10 / L-14, L-15: str + str concatenates; mixing with a number → E_TYPE", () => {
    expect(evalExpr(bin("+", str("a"), str("b"))).data).toBe("ab");
    const e = bin("+", str("a"), num(1));
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_TYPE", params: { left: "str", right: "int" } },
    });
    expect(evalExpr(bin("<", num(1), str("a"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });

  it("N-10 / R-06: every comparison emits one compare event with its result alone", () => {
    const e = bin(">", num(5), num(3));
    const result = evalExpr(e);
    expect(result.events).toEqual([
      {
        type: "compare",
        nodeId: e.id,
        result: true,
      },
    ]);
    expect(result.data).toBe(true);
    expect(evalExpr(bin("==", num(1), float(1))).data).toBe(true);
    expect(evalExpr(bin("!=", str("a"), str("a"))).data).toBe(false);
    expect(evalExpr(bin("<=", str("a"), str("b"))).data).toBe(true);
  });

  it("N-10 / L-17: and / or short-circuit and return the deciding operand", () => {
    expect(evalExpr(bin("or", num(0), num(5))).data).toBe(5);
    expect(evalExpr(bin("and", num(0), bin("/", num(1), num(0)))).data).toBe(0);
    expect(evalExpr(bin("and", num(2), num(3))).data).toBe(3);
    expect(evalExpr(bin("or", str("x"), bin("/", num(1), num(0)))).data).toBe("x");
    expect(
      evalExpr(bin("and", bin("<", num(1), num(2)), bin("<", num(2), num(3)))).events,
    ).toHaveLength(2);
  });

  it("N-10 / L-19, R-04: `in` on a list reads one ref per compared element, then compares", () => {
    const e = bin("in", num(2), v("xs"));
    const result = evalExpr(e, { xs: [1, 2, 3] });
    expect(result.data).toBe(true);
    expect(result.events).toEqual([
      {
        type: "read",
        nodeId: e.id,
        refs: [
          { heap: 1, index: 0 },
          { heap: 1, index: 1 },
        ],
      },
      {
        type: "compare",
        nodeId: e.id,
        result: true,
      },
    ]);
    expect(evalExpr(bin("in", str("b"), str("abc"))).data).toBe(true);
    expect(evalExpr(bin("in", str("k"), v("d")), { d: { k: 1 } }).data).toBe(true);
    expect(evalExpr(bin("in", num(9), v("d")), { d: { k: 1 } }).data).toBe(false);
  });
});
