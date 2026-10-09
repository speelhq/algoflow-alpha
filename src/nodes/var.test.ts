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
});
