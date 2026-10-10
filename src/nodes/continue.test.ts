import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, program, runAll, varData } from "./testing";

const { cont, for_, assign, num, v, bin, while_ } = ast;

describe("continue (nodes.md)", () => {
  it("N-03: emits `continue`", () => {
    expect(emit(program([for_("i", num(0), num(3), [cont()])]), {}).code).toBe(
      "for i in range(3):\n    continue\n",
    );
  });

  it("N-10: skips the rest of the body and moves to the next iteration", () => {
    const result = runAll(
      program([
        assign("n", num(0)),
        for_("i", num(0), num(3), [cont(), assign("n", bin("+", v("n"), num(1)))]),
      ]),
    );
    expect(varData(result, "n")).toBe(0);
    expect(result.done).toMatchObject({ loops: 3 });
  });

  it("N-10: re-evaluates a while condition", () => {
    const result = runAll(
      program([
        assign("k", num(3)),
        while_(bin(">", v("k"), num(0)), [
          assign("k", bin("-", v("k"), num(1))),
          cont(),
          assign("k", num(100)),
        ]),
      ]),
    );
    expect(varData(result, "k")).toBe(0);
  });
});
