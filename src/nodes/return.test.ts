import { describe, expect, it } from "vitest";
import type { FunctionDef } from "@/lang/types";
import { emit } from "@/python/emit";
import { ast, program, runAll, varData } from "./testing";

const { call, num, bin, v, assign, ret, for_, if_ } = ast;

describe("return (nodes.md)", () => {
  it("N-03: emits `return <value>` or `return`", () => {
    const fn: FunctionDef = {
      id: "f0000000000f",
      name: "f",
      params: [],
      body: [if_(v("ok"), [ret(num(1))]), ret()],
    };
    expect(emit(program([], { functions: [fn] }), {}).code).toBe(
      "def f():\n    if ok:\n        return 1\n    return\n",
    );
  });

  it("N-10: leaves the function from inside a loop with the value", () => {
    const first: FunctionDef = {
      id: "f0000000000f",
      name: "first_even",
      params: ["n"],
      body: [
        for_("i", num(0), v("n"), [
          if_(bin("==", bin("%", v("i"), num(2)), num(0)), [ret(v("i"))]),
        ]),
        ret(num(-1)),
      ],
    };
    const result = runAll(
      program([assign("r", call("first_even", num(5)))], { functions: [first] }),
    );
    expect(varData(result, "r")).toBe(0);
    expect(result.done).toMatchObject({ type: "done", loops: 1 });
  });
});
