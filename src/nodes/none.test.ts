import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

describe("none (nodes.md)", () => {
  it("emits None", () => {
    expect(unparse(ast.none())).toBe("None");
  });

  it("evaluates to none", () => {
    expect(evalExpr(ast.none())).toMatchObject({ value: { t: "none" }, data: null, events: [] });
  });
});
