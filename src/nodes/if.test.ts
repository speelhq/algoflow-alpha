import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ifStmt } from "./if";
import { ast, eventTypes, program, runAll, varData } from "./testing";

const { if_, assign, num, bin, v, for_, brk } = ast;
const lines = (main: Parameters<typeof program>[0]) =>
  emit(program(main), {}).code.trimEnd().split("\n");

describe("if (nodes.md)", () => {
  it("N-03: emits `if <cond>:` and `else:`; else omitted when empty; empty region → pass", () => {
    expect(
      lines([if_(bin("<", v("a"), v("b")), [assign("x", num(1))], [assign("x", num(2))])]),
    ).toEqual(["if a < b:", "    x = 1", "else:", "    x = 2"]);
    expect(lines([if_(v("ok"), [assign("x", num(1))])])).toEqual(["if ok:", "    x = 1"]);
    expect(lines([if_(v("ok"), [])])).toEqual(["if ok:", "    pass"]);
  });

  it("N-10: compare event, then only the taken branch runs", () => {
    const stmt = if_(bin("<", num(1), num(2)), [assign("x", num(1))], [assign("x", num(2))]);
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "compare", "enter", "write"]);
    expect(result.events[1]).toMatchObject({
      type: "compare",
      result: true,
    });
    expect(varData(result, "x")).toBe(1);
  });

  it("R-35: a condition that is no comparison ends in a compare of its own", () => {
    const cond = v("ok");
    const result = runAll(program([assign("ok", num(0)), if_(cond, [])]));
    expect(eventTypes(result.events)).toEqual(["enter", "write", "enter", "compare"]);
    expect(result.events[3]).toEqual({ type: "compare", nodeId: cond.id, result: false });
  });

  it("N-10: a false condition runs else (L-18 truthiness)", () => {
    const result = runAll(program([if_(num(0), [assign("x", num(1))], [assign("x", num(2))])]));
    expect(varData(result, "x")).toBe(2);
  });

  it("N-10: break inside an if leaves the enclosing loop", () => {
    const loop = for_("i", num(0), num(10), [
      if_(bin("==", v("i"), num(2)), [brk()]),
      assign("last", v("i")),
    ]);
    const result = runAll(program([assign("last", num(-1)), loop]));
    expect(varData(result, "last")).toBe(1);
    expect(result.done).toMatchObject({ type: "done", loops: 3 });
  });

  it("N-09: a branch with `then` as Yes and `else` as No", () => {
    expect(ifStmt.chart).toEqual({ branch: { cond: "cond", yes: "then", no: "else" } });
  });
});
