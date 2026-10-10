import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { getNode } from "./registry";
import { ast, eventTypes, program, runAll } from "./testing";

const { exprStmt, call, num, bin } = ast;

describe("expr (nodes.md)", () => {
  it("N-01, N-04: is hidden from the block menu", () => {
    expect(getNode("expr").hidden).toBe(true);
  });

  it("N-03: emits the expression alone", () => {
    expect(emit(program([exprStmt(call("abs", num(-1)))])).code).toBe("abs(-1)\n");
  });

  it("N-10: evaluates the expression for its events and discards the value", () => {
    const stmt = exprStmt(bin("<", num(1), num(2)));
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "compare"]);
    expect(result.state.frames[0]?.vars.size).toBe(0);
  });

  it("N-10: a failing expression fails the statement", () => {
    const stmt = exprStmt(bin("/", num(1), num(0)));
    expect(runAll(program([stmt])).done).toMatchObject({
      type: "error",
      error: { code: "E_DIV_ZERO" },
    });
  });
});
