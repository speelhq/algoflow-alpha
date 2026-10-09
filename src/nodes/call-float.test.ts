import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { call, num, str, bool, none } = ast;

describe("builtin float (nodes.md)", () => {
  it("N-03: emits `float(<x>)`", () => {
    expect(unparse(call("float", num(1)))).toBe("float(1)");
  });

  it("N-10: converts numbers, numeric text, and bools to float", () => {
    expect(evalExpr(call("float", num(3))).value).toEqual({ t: "float", v: 3 });
    expect(evalExpr(call("float", str("2.5"))).value).toEqual({ t: "float", v: 2.5 });
    expect(evalExpr(call("float", str("1e3"))).value).toEqual({ t: "float", v: 1000 });
    expect(evalExpr(call("float", bool(false))).value).toEqual({ t: "float", v: 0 });
  });

  it("N-10: non-numeric text or none → E_TYPE", () => {
    expect(evalExpr(call("float", str("x"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
    expect(evalExpr(call("float", none())).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });
});
