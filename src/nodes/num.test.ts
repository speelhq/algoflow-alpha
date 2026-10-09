import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { num, float } = ast;

describe("num (nodes.md)", () => {
  it("N-03 / L-08: emits raw", () => {
    expect(unparse(num(5))).toBe("5");
    expect(unparse(num(1000, "1e3"))).toBe("1e3");
    expect(unparse(num(2.5, "2.50"))).toBe("2.50");
    expect(unparse(float(2))).toBe("2.0");
  });

  it("N-10: evaluates to int or float by the float flag, with no events", () => {
    expect(evalExpr(num(5))).toMatchObject({ value: { t: "int", v: 5 }, events: [] });
    expect(evalExpr(float(2))).toMatchObject({ value: { t: "float", v: 2 }, data: { $float: 2 } });
    expect(evalExpr(num(2.5)).value).toEqual({ t: "float", v: 2.5 });
  });
});
