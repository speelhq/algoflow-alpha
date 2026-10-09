import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { forStmt } from "./for";
import { ast, eventTypes, program, runAll, varData } from "./testing";

const { for_, assign, num, float, bin, v, brk, cont, if_ } = ast;
const lines = (main: Parameters<typeof program>[0]) =>
  emit(program(main)).code.trimEnd().split("\n");

describe("for (nodes.md)", () => {
  it("N-03: `range(<stop>)` when start is num 0, else `range(<start>, <stop>)`", () => {
    expect(lines([for_("i", num(0), v("n"), [assign("x", v("i"))])])).toEqual([
      "for i in range(n):",
      "    x = i",
    ]);
    expect(lines([for_("i", num(1), bin("+", v("n"), num(1)), [])])).toEqual([
      "for i in range(1, n + 1):",
      "    pass",
    ]);
    expect(lines([for_("i", float(0), num(3), [])])[0]).toBe("for i in range(0.0, 3):");
  });

  it("N-10 / R-07: one loop event per iteration carrying var and value", () => {
    const stmt = for_("i", num(0), num(2), [assign("x", v("i"))]);
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual([
      "enter",
      "loop",
      "enter",
      "write",
      "loop",
      "enter",
      "write",
    ]);
    expect(result.events[1]).toEqual({
      type: "loop",
      nodeId: stmt.id,
      var: "i",
      value: { t: "int", v: 0 },
    });
    expect(varData(result, "x")).toBe(1);
    expect(result.done).toEqual({ type: "done", steps: 7, loops: 2 });
  });

  it("N-10 / L-25, L-43: bounds are evaluated once; the variable stays visible after the loop", () => {
    const result = runAll(
      program([for_("i", num(0), v("n"), [assign("n", bin("+", v("n"), num(1)))])], {
        inputs: [{ name: "n", value: 3 }],
      }),
    );
    expect(result.done).toMatchObject({ loops: 3 });
    expect(varData(result, "i")).toBe(2);
  });

  it("N-10: break stops and continue skips the rest of the body", () => {
    const result = runAll(
      program([
        assign("acc", num(0)),
        for_("i", num(0), num(10), [
          if_(bin("==", v("i"), num(1)), [cont()]),
          if_(bin("==", v("i"), num(4)), [brk()]),
          assign("acc", bin("+", v("acc"), v("i"))),
        ]),
      ]),
    );
    expect(varData(result, "acc")).toBe(0 + 2 + 3);
  });

  it("N-10 / L-25: a float bound → E_TYPE", () => {
    const stmt = for_("i", num(0), float(2.5), []);
    const result = runAll(program([stmt]));
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_TYPE", params: { left: "int", right: "float" } },
    });
  });

  it("N-09: a counted loop over `body`", () => {
    expect(forStmt.chart).toEqual({ counted: "body" });
  });
});
