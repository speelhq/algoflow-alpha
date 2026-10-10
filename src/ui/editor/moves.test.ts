// U-36, L-60: where a dragged statement lands, which connectors accept it, and refused drops.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { emit } from "@/python/emit";
import { accepts, moveTarget, tryMove } from "./moves";

const { assign, num, print, v, while_, brk, if_ } = ast;
const code = (p: ReturnType<typeof program>) => emit(p, {}).code.trim().split("\n");

describe("moves (U-36)", () => {
  it("L-60: a place after the statement in its own region counts after its removal", () => {
    const a = print(num(1));
    const b = print(num(2));
    const c = print(num(3));
    const p = program([a, b, c]);
    expect(moveTarget(p, a.id, { parent: "main", slot: "main", index: 3 })).toEqual({
      parent: "main",
      slot: "main",
      index: 2,
    });
    expect(moveTarget(p, c.id, { parent: "main", slot: "main", index: 0 }).index).toBe(0);
    const moved = tryMove(p, a.id, { parent: "main", slot: "main", index: 3 });
    expect("program" in moved && code(moved.program)).toEqual(["print(2)", "print(3)", "print(1)"]);
  });

  it("U-36: a statement moves across regions", () => {
    const out = print(v("x"));
    const loop = while_(v("x"), []);
    const p = program([assign("x", num(1)), loop, out]);
    const moved = tryMove(p, out.id, { parent: loop.id, slot: "body", index: 0 });
    expect("program" in moved && code(moved.program)).toEqual([
      "x = 1",
      "while x:",
      "    print(x)",
    ]);
  });

  it("U-36: the connectors inside the dragged statement accept no drop", () => {
    const inner = print(num(1));
    const branch = if_(v("c"), [inner]);
    const loop = while_(v("c"), [branch]);
    const p = program([loop]);
    expect(accepts(p, loop.id, { parent: loop.id, slot: "body", index: 0 })).toBe(false);
    expect(accepts(p, loop.id, { parent: branch.id, slot: "then", index: 0 })).toBe(false);
    expect(accepts(p, loop.id, { parent: "main", slot: "main", index: 1 })).toBe(true);
    expect(accepts(p, inner.id, { parent: loop.id, slot: "body", index: 0 })).toBe(true);
  });

  it("U-36: a drop that takes break out of its loop is refused with the message", () => {
    const stop = brk();
    const loop = while_(v("c"), [stop]);
    const p = program([assign("c", num(1)), loop]);
    expect(tryMove(p, stop.id, { parent: "main", slot: "main", index: 0 })).toEqual({
      refused: "This block only works inside a loop",
    });
    expect("program" in tryMove(p, stop.id, { parent: loop.id, slot: "body", index: 1 })).toBe(
      true,
    );
  });
});
