import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

describe("var (nodes.md)", () => {
  it("N-03: emits the name", () => {
    expect(unparse(ast.v("total"))).toBe("total");
  });

  it("N-10 / R-04: reads the variable and emits no event", () => {
    expect(evalExpr(ast.v("n"), { n: 7 })).toMatchObject({ data: 7, events: [] });
  });

  it("N-10 / R-09: a variable never assigned → E_UNDEFINED with its name", () => {
    const e = ast.v("ghost");
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_UNDEFINED", params: { name: "ghost" } },
    });
  });
});
