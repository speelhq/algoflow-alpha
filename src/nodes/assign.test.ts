import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, eventTypes, program, runAll, varData, withInputs } from "./testing";

const { assign, assignTo, num, bin, v } = ast;
const lines = (main: Parameters<typeof program>[0]) =>
  emit(program(main), {}).code.trimEnd().split("\n");

describe("assign (nodes.md)", () => {
  it("N-03: emits `<target> = <value>`", () => {
    expect(lines([assign("x", bin("+", num(1), num(2)))])).toEqual(["x = 1 + 2"]);
    expect(lines([assignTo({ kind: "index", list: v("xs"), index: num(0) }, num(9))])).toEqual([
      "xs[0] = 9",
    ]);
  });

  it("N-10 / R-05: enter then write, and the variable is set", () => {
    const stmt = assign("x", num(5));
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "write"]);
    expect(result.events[1]).toEqual({
      type: "write",
      nodeId: stmt.id,
      ref: { var: "x" },
      value: { t: "int", v: 5 },
    });
    expect(varData(result, "x")).toBe(5);
    expect(result.done).toEqual({ type: "done", steps: 2, loops: 0 });
  });

  it("N-10: an index target writes the heap slot (L-20, negative from the end)", () => {
    const stmt = assignTo({ kind: "index", list: v("xs"), index: num(-1) }, num(9));
    const made = withInputs({ xs: [1, 2] }, [stmt]);
    const result = runAll(made.program, made.inputs);
    expect(varData(result, "xs")).toEqual([1, 9]);
    expect(result.events[1]).toMatchObject({ type: "write", ref: { heap: 1, index: 1 } });
  });

  it("N-10: an index out of range → E_INDEX with index and length", () => {
    const stmt = assignTo({ kind: "index", list: v("xs"), index: num(5) }, num(0));
    const made = withInputs({ xs: [1, 2] }, [stmt]);
    const result = runAll(made.program, made.inputs);
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_INDEX", params: { index: 5, length: 2 } },
    });
  });
});
