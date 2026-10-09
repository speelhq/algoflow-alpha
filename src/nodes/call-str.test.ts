import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { call, num, float, bool, none, v } = ast;

describe("builtin str (nodes.md)", () => {
  it("N-03: emits `str(<x>)`", () => {
    expect(unparse(call("str", num(1)))).toBe("str(1)");
  });

  it("N-10 / L-29: the str() form of any value", () => {
    expect(evalExpr(call("str", num(12))).data).toBe("12");
    expect(evalExpr(call("str", float(2))).data).toBe("2.0");
    expect(evalExpr(call("str", bool(true))).data).toBe("True");
    expect(evalExpr(call("str", none())).data).toBe("None");
    expect(evalExpr(call("str", v("xs")), { xs: [1, "a"] }).data).toBe("[1, 'a']");
    expect(evalExpr(call("str", v("d")), { d: { a: 1, "$int:2": "x" } }).data).toBe(
      "{'a': 1, 2: 'x'}",
    );
  });
});
