import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, program, runAll, varData } from "./testing";

const { brk, for_, assign, num, v, while_, bool } = ast;

describe("break (nodes.md)", () => {
  it("N-03: emits `break`", () => {
    expect(emit(program([while_(bool(true), [brk()])])).code).toBe("while True:\n    break\n");
  });

  it("N-10: leaves the innermost loop only", () => {
    const result = runAll(
      program([
        assign("outer", num(0)),
        for_("i", num(0), num(3), [
          for_("j", num(0), num(3), [brk(), assign("outer", num(99))]),
          assign("outer", v("i")),
        ]),
      ]),
    );
    expect(varData(result, "outer")).toBe(2);
    expect(result.done).toMatchObject({ loops: 6 });
  });
});
