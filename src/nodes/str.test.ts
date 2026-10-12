import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { str } = ast;

describe("str (nodes.md)", () => {
  it('double quotes with \\\\ \\" \\n \\t escaped', () => {
    expect(unparse(str("Hello, "))).toBe('"Hello, "');
    expect(unparse(str('say "hi"\n\ttab\\'))).toBe('"say \\"hi\\"\\n\\ttab\\\\"');
    expect(unparse(str("it's"))).toBe('"it\'s"');
  });

  it("evaluates to a str value with no events", () => {
    expect(evalExpr(str("ab"))).toMatchObject({
      value: { t: "str", v: "ab" },
      data: "ab",
      events: [],
    });
  });
});
