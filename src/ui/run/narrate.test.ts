// U-63, U-116, U-117, U-118, U-119: one sentence per event; a comparison as the chart writes it,
// with the values of the moment; a diamond's question and its answer; values as the blocks write
// them; a named node by its statement; a location by the variable that holds it.
import { describe, expect, it } from "vitest";
import { t } from "@/i18n/t";
import type { Data, Program } from "@/lang/types";
import { ast, program, tid, withInputs } from "@/nodes/testing";
import { run } from "@/runtime/run";
import type { Event } from "@/runtime/types";
import { valueText } from "@/ui/chart/text";
import { narrate, narrateDifference, narrateEnd, type Narration } from "./narrate";

const { assign, num, float, str, bool, none, bin, not, v, print, for_, while_, if_ } = ast;
const { exprStmt, call, ret } = ast;

const say = (n: Narration) => t(n.key, n.params);

/** Runs to the `nth` event of `type` and narrates it with the state of that moment. */
function told(p: Program, type: Event["type"], nth = 1, inputs: Record<string, Data> = {}) {
  const runner = run(p, inputs, 1);
  let seen = 0;
  for (;;) {
    const next = runner.next();
    if (next.type === "done" || next.type === "error") throw new Error(`no ${type} #${nth}`);
    if (next.type === type && (seen += 1) === nth) {
      const state = runner.state();
      return say(narrate(next, { program: p, state, frame: state.frames.length - 1, pass: nth }));
    }
  }
}

describe("narrate (U-63)", () => {
  it("enter: `Checking …` for a condition, the block's sentence otherwise", () => {
    const check = if_(bin("==", bin("%", v("i"), num(3)), num(0)), []);
    const p = program([assign("i", num(6)), check, while_(bin(">", v("i"), num(9)), [])]);
    expect(told(p, "enter", 1)).toBe("Create i and set it to 6");
    expect(told(p, "enter", 2)).toBe("Checking (remainder of i divided by 3) = 0");
    expect(told(p, "enter", 3)).toBe("Checking i > 9");
    expect(told(program([for_("i", num(1), num(3), [])]), "enter")).toBe("For i from 1 up to 3");
  });

  it("U-118 enter: a named node is narrated by its statement, not its name", () => {
    const named = { ...assign("i", num(6)), name: "start counting" };
    expect(told(program([named]), "enter")).toBe("Create i and set it to 6");
  });

  it("U-116 compare: a diamond's whole condition is its question with the values, and its answer", () => {
    const p = program([
      assign("n", num(4)),
      if_(bin(">", bin("+", v("n"), num(1)), num(3)), []),
      if_(bin("==", v("n"), num(5)), []),
    ]);
    expect(told(p, "compare", 1)).toBe("4 + 1 > 3? Yes");
    expect(told(p, "compare", 2)).toBe("4 = 5? No");
  });

  it("U-116 compare: FizzBuzz at i = 3 writes its operations as the chart does", () => {
    const p = program([
      assign("i", num(3)),
      if_(bin("==", bin("%", v("i"), num(15)), num(0)), []),
      if_(bin("==", bin("%", bin("+", v("i"), num(1)), num(2)), num(0)), []),
    ]);
    expect(told(p, "compare", 1)).toBe("(remainder of 3 divided by 15) = 0? No");
    expect(told(p, "compare", 2)).toBe("(remainder of (3 + 1) divided by 2) = 0? Yes");
  });

  it("compare: any other comparison, such as a side of and, says its value", () => {
    const both = bin("and", bin("<", v("a"), num(2)), bin("<", v("a"), num(9)));
    const p = program([
      assign("a", num(1)),
      if_(both, []),
      assign("ok", bin("!=", v("a"), num(1))),
    ]);
    expect(told(p, "compare", 1)).toBe("1 < 2 is true");
    expect(told(p, "compare", 3)).toBe("1 < 2 and 1 < 9? Yes");
    expect(told(p, "compare", 4)).toBe("1 ≠ 1 is false");
    const negated = program([assign("a", num(1)), while_(not(bin(">=", v("a"), num(1))), [])]);
    expect(told(negated, "compare", 1)).toBe("1 ≥ 1 is true");
    expect(told(negated, "compare", 2)).toBe("not (1 ≥ 1)? No");
  });

  it("U-116 compare: a condition that is one variable keeps its name; inside one it is a value", () => {
    const p = program([
      assign("found", bool(true)),
      assign("i", num(3)),
      if_(v("found"), []),
      while_(bin("and", not(v("found")), bin("<", v("i"), num(15))), []),
    ]);
    expect(told(p, "compare", 1)).toBe("found? Yes");
    expect(told(p, "compare", 2)).toBe("(not true) and 3 < 15? No");
  });

  it("U-117 compare: values are written with the block words, never Python's", () => {
    const p = program([
      assign("done", bool(true)),
      assign("name", str("Fizz")),
      if_(bin("==", v("done"), bool(false)), []),
      if_(bin("!=", v("name"), none()), []),
    ]);
    expect(told(p, "compare", 1)).toBe("true = false? No");
    expect(told(p, "compare", 2)).toBe('"Fizz" ≠ none? Yes');
  });

  it("write, loop, print, call, and return", () => {
    const fn = { id: tid(), name: "f", params: ["x"], body: [ret(bin("*", v("x"), num(2)))] };
    const p = program(
      [
        for_("i", num(3), num(5), [assign("half", float(1.5)), print(str("Fizz"))]),
        while_(bin("<", v("i"), num(5)), [assign("i", num(9))]),
        exprStmt(call("f", num(2))),
      ],
      { functions: [fn] },
    );
    expect(told(p, "loop", 1)).toBe("Pass 1: i is 3");
    expect(told(p, "write", 1)).toBe("half is now 1.5");
    expect(told(p, "print", 1)).toBe('Printed "Fizz"');
    expect(told(p, "loop", 3)).toBe("Pass 3"); // a while: no variable (the pass comes from R-12)
    expect(told(p, "call")).toBe("Calling f(2)");
    expect(told(p, "return")).toBe("f returned 4");
  });

  it("U-119 read and swap name the list by the variable that holds it", () => {
    const { program: p, inputs } = withInputs({ nums: [4, 9, 5], x: 5 }, [
      if_(bin("in", v("x"), v("nums")), []),
    ]);
    expect(told(p, "read", 1, inputs)).toBe("Read 3 items of nums");
    // A list keeps its name: its items were narrated by the read before the comparison.
    expect(told(p, "compare", 1, inputs)).toBe("5 is in nums? Yes");

    const runner = run(p, inputs, 1);
    const state = runner.state();
    const ctx = { program: p, state, frame: 0, pass: null };
    const read: Event = { type: "read", nodeId: "none", refs: [{ heap: 1, index: 2 }] };
    expect(say(narrate(read, ctx))).toBe("Read item 2 of nums: 5");
    const swap: Event = {
      type: "swap",
      nodeId: "none",
      a: { heap: 1, index: 1 },
      b: { heap: 1, index: 2 },
    };
    expect(say(narrate(swap, ctx))).toBe("Swapped items 1 and 2 of nums");
    const item: Event = {
      type: "write",
      nodeId: "none",
      ref: { heap: 1, index: 0 },
      value: { t: "none" },
    };
    expect(say(narrate(item, ctx))).toBe("item 0 of nums is now none");
  });

  it("the end of the run, an error, and the step Watch this case opens at", () => {
    expect(say(narrateEnd({ type: "done", steps: 124, loops: 3 }, 124))).toBe(
      "Finished in 124 steps",
    );
    const error = { nodeId: "x", code: "E_INDEX" as const, params: { index: 5, length: 3 } };
    expect(say(narrateEnd({ type: "error", error, steps: 8 }, 9))).toBe(
      "Item 5 does not exist (length 3)",
    );
    const value = { nodeId: "x", code: "E_VALUE" as const, params: { op: "unop", type: "str" } };
    expect(say(narrateEnd({ type: "error", error: value, steps: 2 }, 3))).toBe(
      "Negate cannot be used on str",
    );
    expect(say(narrateDifference({ line: 1 }))).toBe("This printed line 1");
    expect(say(narrateDifference({}))).toBe("The run ended here");
  });

  it("U-117 valueText writes containers with the same words inside", () => {
    const made = withInputs({ d: { a: [true, null, "x", { $float: 2 }], "$int:3": 1 } }, []);
    const runner = run(made.program, made.inputs, 1);
    const { frames, heap } = runner.state();
    const value = frames[0]?.vars.get("d");
    expect(value && valueText(value, heap)).toBe('{"a": [true, none, "x", 2.0], 3: 1}');
  });
});
