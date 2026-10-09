import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { call, num, float, str, bool, none } = ast;

describe("builtin int (nodes.md)", () => {
  it("N-03: emits `int(<x>)`", () => {
    expect(unparse(call("int", str("42")))).toBe('int("42")');
  });

  it("N-10: truncates floats, parses integer text, True → 1", () => {
    expect(evalExpr(call("int", float(-2.7))).value).toEqual({ t: "int", v: -2 });
    expect(evalExpr(call("int", str(" 42 "))).value).toEqual({ t: "int", v: 42 });
    expect(evalExpr(call("int", bool(true))).value).toEqual({ t: "int", v: 1 });
    expect(evalExpr(call("int", num(3))).value).toEqual({ t: "int", v: 3 });
  });

  it("N-10: non-integer text or none → E_TYPE", () => {
    expect(evalExpr(call("int", str("4.2"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
    expect(evalExpr(call("int", none())).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });
});
