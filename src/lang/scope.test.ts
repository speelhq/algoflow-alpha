// L-40, L-41, L-43: what is visible where; N-01 `loop` and `requires` places; U-52 Variables.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { placeContext, siteOf, visibleAt } from "./scope";
import type { Stmt } from "./types";

const { assign, num, v, bin, print, for_, if_, while_, ret } = ast;

describe("scope", () => {
  it("L-40, U-52: names assigned before a statement are visible, the latest first", () => {
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

  it("L-43: a loop variable is visible in the body and after the loop, not in its own bounds", () => {
    const inner = print(v("i"));
    const loop = for_("i", num(0), v("n"), [inner]);
    const after = print(v("i"));
    const p = program([loop, after], { inputs: [{ name: "n", kind: "number" }] });
    expect(visibleAt(p, loop.id)).toEqual(["n"]);
    expect(visibleAt(p, inner.id)).toEqual(["i", "n"]);
    expect(visibleAt(p, after.id)).toEqual(["i", "n"]);
  });

  it("L-41: a name first assigned inside a frame is not visible after it", () => {
    const inside = assign("y", num(1));
    const branch = if_(v("c"), [inside]);
    const after = print(v("y"));
    const p = program([assign("c", num(1)), branch, after]);
    expect(visibleAt(p, after.id)).toEqual(["c"]);
  });

  it("L-42: a function sees its parameters", () => {
    const body = ret(v("x"));
    const p = program([], {
      functions: [{ id: "fn0000000001", name: "f", params: ["x", "y"], body: [body] }],
    });
    expect(visibleAt(p, body.id)).toEqual(["y", "x"]);
  });

  it("N-01: a place is in a loop under a loop's body at any depth, and in a function under one", () => {
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

  it("finds the slot and item that hold a nested expression", () => {
    const left = v("i");
    const sum = bin("+", left, num(1));
    const two = num(2);
    const out = print(sum, two);
    const target = ast.assignTo({ kind: "index", list: v("xs"), index: num(0) }, num(9));
    const p = program([out, target]);
    expect(siteOf(p, sum.id)).toEqual({ owner: out.id, slot: "args", index: 0 });
    expect(siteOf(p, two.id)).toEqual({ owner: out.id, slot: "args", index: 1 });
    expect(siteOf(p, left.id)).toEqual({ owner: sum.id, slot: "left" });
    const index = (target as Extract<Stmt, { kind: "assign" }>).target;
    if (index.kind !== "index") throw new Error("not an index target");
    expect(siteOf(p, index.index.id)).toEqual({ owner: target.id, slot: "target.index" });
    expect(siteOf(p, "nope00000000")).toBeUndefined();
  });
});
