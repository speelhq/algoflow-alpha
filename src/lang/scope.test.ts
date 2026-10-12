// What is visible where; the places `loop` and `requires` allow; the value list's Variables.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { assignedValue, placeContext, visibleAt } from "./scope";

const { assign, num, v, bin, print, for_, if_, while_, ret } = ast;

describe("scope", () => {
  it("the value a statement with a target assigns is its expression slot; others none", () => {
    const value = bin("+", v("a"), num(1));
    expect(assignedValue(assign("a", value))).toBe(value);
    const nine = num(9);
    expect(assignedValue(ast.assignTo({ kind: "index", list: v("xs"), index: num(0) }, nine))).toBe(
      nine,
    );
    expect(assignedValue(print(v("a")))).toBeUndefined();
    expect(assignedValue(for_("i", num(0), num(3), []))).toBeUndefined();
  });

  it("names assigned before a statement are visible, the latest first", () => {
    const a = assign("a", num(1));
    const b = assign("b", num(2));
    const again = assign("a", num(3));
    const here = print(v("a"));
    const p = program([a, b, again, here], { inputs: [{ name: "n", kind: "number" }] });
    expect(visibleAt(p, a.id)).toEqual(["n"]);
    expect(visibleAt(p, b.id)).toEqual(["a", "n"]);
    expect(visibleAt(p, here.id)).toEqual(["a", "b", "n"]);
    expect(visibleAt(p, "nope00000000")).toBeUndefined();
  });

  it("a loop variable is visible in the body and after the loop, not in its own bounds", () => {
    const inner = print(v("i"));
    const loop = for_("i", num(0), v("n"), [inner]);
    const after = print(v("i"));
    const p = program([loop, after], { inputs: [{ name: "n", kind: "number" }] });
    expect(visibleAt(p, loop.id)).toEqual(["n"]);
    expect(visibleAt(p, inner.id)).toEqual(["i", "n"]);
    expect(visibleAt(p, after.id)).toEqual(["i", "n"]);
  });

  it("a name first assigned inside a frame is not visible after it", () => {
    const inside = assign("y", num(1));
    const branch = if_(v("c"), [inside]);
    const after = print(v("y"));
    const p = program([assign("c", num(1)), branch, after]);
    expect(visibleAt(p, after.id)).toEqual(["c"]);
  });

  it("a function sees its parameters", () => {
    const body = ret(v("x"));
    const p = program([], {
      functions: [{ id: "fn0000000001", name: "f", params: ["x", "y"], body: [body] }],
    });
    expect(visibleAt(p, body.id)).toEqual(["y", "x"]);
  });

  it("a place is in a loop under a loop's body at any depth, and in a function under one", () => {
    const branch = if_(v("c"), []);
    const loop = while_(v("c"), [branch]);
    const p = program([loop], {
      functions: [{ id: "fn0000000001", name: "f", params: [], body: [] }],
    });
    expect(placeContext(p, { parent: "main", slot: "main", index: 0 })).toEqual({
      loop: false,
      fn: false,
    });
    expect(placeContext(p, { parent: loop.id, slot: "body", index: 0 })).toEqual({
      loop: true,
      fn: false,
    });
    expect(placeContext(p, { parent: branch.id, slot: "then", index: 0 })).toEqual({
      loop: true,
      fn: false,
    });
    expect(placeContext(p, { parent: "fn0000000001", slot: "body", index: 0 })).toEqual({
      loop: false,
      fn: true,
    });
  });
});
