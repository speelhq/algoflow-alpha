import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { num, float, str, bin, v, neg, bool } = ast;

describe("binop (nodes.md)", () => {
  it("infix with parentheses only where precedence requires", () => {
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

  it("int ∘ int stays int except `/`; any float makes float", () => {
    expect(evalExpr(bin("//", num(7), num(2))).value).toEqual({ t: "int", v: 3 });
    expect(evalExpr(bin("/", num(4), num(2))).value).toEqual({ t: "float", v: 2 });
    expect(evalExpr(bin("+", num(1), float(2))).value).toEqual({ t: "float", v: 3 });
    expect(evalExpr(bin("*", num(3), num(4))).value).toEqual({ t: "int", v: 12 });
    expect(evalExpr(bin("**", num(2), num(10))).value).toEqual({ t: "int", v: 1024 });
    expect(evalExpr(bin("**", num(2), neg(num(1)))).value).toEqual({ t: "float", v: 0.5 });
  });

  it("`//` floors and `%` takes the divisor's sign", () => {
    expect(evalExpr(bin("//", neg(num(7)), num(2))).data).toBe(-4);
    expect(evalExpr(bin("%", neg(num(7)), num(2))).data).toBe(1);
    expect(evalExpr(bin("%", num(7), neg(num(2)))).data).toBe(-1);
  });

  it("`//` and `%` on floats follow CPython, the sign of zero included", () => {
    expect(evalExpr(bin("%", num(1), float(0.1))).data).toBe(1 % 0.1); // 0.09999999999999995 in both engines
    expect(evalExpr(bin("//", num(1), float(0.1))).data).toEqual({ $float: 9 });
    expect(evalExpr(bin("%", float(-7.5), num(2))).data).toBe(0.5);
    expect(evalExpr(bin("//", float(-7.5), num(2))).data).toEqual({ $float: -4 });
    const negativeZero = evalExpr(bin("%", float(4), neg(num(2)))).value;
    expect(negativeZero.t === "float" && Object.is(negativeZero.v, -0)).toBe(true);
    expect(evalExpr(bin("%", float(0.1), float(0.01))).data).toBe(0.1 % 0.01);
  });

  it("division or modulo by zero → E_DIV_ZERO", () => {
    for (const op of ["/", "//", "%"] as const) {
      const e = bin(op, num(1), num(0));
      expect(evalExpr(e).done).toMatchObject({
        type: "error",
        error: { nodeId: e.id, code: "E_DIV_ZERO" },
      });
    }
    expect(evalExpr(bin("%", float(1), num(0))).done).toMatchObject({
      type: "error",
      error: { code: "E_DIV_ZERO" },
    });
  });

  it("zero to a negative power → E_DIV_ZERO; zero to the power zero is 1", () => {
    for (const zero of [num(0), float(0)]) {
      expect(evalExpr(bin("**", zero, neg(num(1)))).done).toMatchObject({
        type: "error",
        error: { code: "E_DIV_ZERO" },
      });
    }
    expect(evalExpr(bin("**", num(0), num(0))).value).toEqual({ t: "int", v: 1 });
  });

  it("str + str concatenates; mixing with a number → E_TYPE", () => {
    expect(evalExpr(bin("+", str("a"), str("b"))).data).toBe("ab");
    const e = bin("+", str("a"), num(1));
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_TYPE", params: { left: "str", right: "int" } },
    });
    expect(evalExpr(bin("+", num(1), str("b"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "int", right: "str" } },
    });
  });

  it("ordering a number with a text → E_TYPE naming both types", () => {
    expect(evalExpr(bin("<", num(1), str("a"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "int", right: "str" } },
    });
  });

  it("== compares numbers and texts by value, lists and dicts by their items", () => {
    expect(evalExpr(bin("==", num(1), float(1))).data).toBe(true);
    expect(evalExpr(bin("==", str("a"), str("a"))).data).toBe(true);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: [1, [2]], q: [1, [2]] }).data).toBe(true);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: { a: 1 }, q: { a: 1 } }).data).toBe(true);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: { a: 1 }, q: { a: 2 } }).data).toBe(false);
    expect(evalExpr(bin("==", num(1), str("1"))).data).toBe(false);
  });

  it("== compares a bool and a number as 0 or 1 and the number, as Python does", () => {
    expect(evalExpr(bin("==", bool(true), num(1))).data).toBe(true);
    expect(evalExpr(bin("==", num(0), bool(false))).data).toBe(true);
    expect(evalExpr(bin("==", bool(true), float(1))).data).toBe(true);
    expect(evalExpr(bin("!=", num(2), bool(true))).data).toBe(true);
    expect(evalExpr(bin("==", bool(true), str("1"))).data).toBe(false);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: [1, 0], q: [true, false] }).data).toBe(true);
    expect(evalExpr(bin("in", num(0), v("xs")), { xs: [false] }).data).toBe(true);
  });

  it("every comparison emits one compare event with its result alone", () => {
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

  it("and / or short-circuit and return the deciding operand", () => {
    expect(evalExpr(bin("or", num(0), num(5))).data).toBe(5);
    expect(evalExpr(bin("and", num(0), bin("/", num(1), num(0)))).data).toBe(0);
    expect(evalExpr(bin("and", num(2), num(3))).data).toBe(3);
    expect(evalExpr(bin("or", str("x"), bin("/", num(1), num(0)))).data).toBe("x");
    expect(
      evalExpr(bin("and", bin("<", num(1), num(2)), bin("<", num(2), num(3)))).events,
    ).toHaveLength(2);
  });

  it("`in` on a list reads one ref per compared element, then compares", () => {
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
    expect(evalExpr(bin("in", float(1), v("xs")), { xs: [1, 2] }).data).toBe(true);
    expect(evalExpr(bin("in", num(3), v("xs")), { xs: [1, 2] }).data).toBe(false);
    expect(evalExpr(bin("in", str("b"), str("abc"))).data).toBe(true);
    expect(evalExpr(bin("in", str("bc"), str("abcd"))).data).toBe(true);
    expect(evalExpr(bin("in", str("k"), v("d")), { d: { k: 1 } }).data).toBe(true);
    expect(evalExpr(bin("in", num(9), v("d")), { d: { k: 1 } }).data).toBe(false);
    expect(evalExpr(bin("in", num(3), v("d")), { d: { "$int:3": "x" } }).data).toBe(true);
    expect(evalExpr(bin("in", num(1), str("a"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });
});
