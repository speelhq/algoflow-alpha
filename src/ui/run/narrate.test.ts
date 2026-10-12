// One sentence per event; a comparison as the chart writes it,
// with the values of the moment; a diamond's question and its answer; values as the blocks write
// them; a named node by its statement; a location by the variable that holds it.
import { describe, expect, it } from "vitest";
import { t } from "@/i18n/t";
import type { Data, Program } from "@/lang/types";
import { ast, program, tid, withInputs } from "@/nodes/testing";
import { run } from "@/runtime/run";
import type { Event } from "@/runtime/types";
import {
  narrate,
  narrateDifference,
  narrateEnd,
  narratePosition,
  type Narration,
  type Position,
} from "./narrate";

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

describe("narrate", () => {
  it("enter: `Checking …` for a condition, the block's sentence otherwise", () => {
    const check = if_(bin("==", bin("%", v("i"), num(3)), num(0)), []);
    const p = program([assign("i", num(6)), check, while_(bin(">", v("i"), num(9)), [])]);
    expect(told(p, "enter", 1)).toBe("Create i and set it to 6");
    expect(told(p, "enter", 2)).toBe("Checking (remainder of i divided by 3) = 0");
    expect(told(p, "enter", 3)).toBe("Checking i > 9");
    expect(told(program([for_("i", num(1), num(3), [])]), "enter")).toBe("For i from 1 up to 3");
  });

  it("enter: a named node is narrated by its statement, not its name", () => {
    const named = { ...assign("i", num(6)), name: "start counting" };
    expect(told(program([named]), "enter")).toBe("Create i and set it to 6");
  });

  it("compare: a diamond's whole condition is its question with the values, and its answer", () => {
    const p = program([
      assign("n", num(4)),
      if_(bin(">", bin("+", v("n"), num(1)), num(3)), []),
      if_(bin("==", v("n"), num(5)), []),
    ]);
    expect(told(p, "compare", 1)).toBe("4 + 1 > 3? Yes");
    expect(told(p, "compare", 2)).toBe("4 = 5? No");
  });

  it("compare: FizzBuzz at i = 3 writes its operations as the chart does", () => {
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

  it("compare: a condition that is one variable keeps its name; inside one it is a value", () => {
    const p = program([
      assign("found", bool(true)),
      assign("i", num(3)),
      if_(v("found"), []),
      while_(bin("and", not(v("found")), bin("<", v("i"), num(15))), []),
    ]);
    expect(told(p, "compare", 1)).toBe("found? Yes");
    expect(told(p, "compare", 2)).toBe("(not true) and 3 < 15? No");
  });

  it("compare: values are written with the block words, never Python's", () => {
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
    expect(told(p, "loop", 3)).toBe("Pass 3"); // a while: no variable (the pass comes from the driver)
    expect(told(p, "call")).toBe("Calling f(2)");
    expect(told(p, "return")).toBe("f returned 4");
  });

  it("read and swap name the list by the variable that holds it", () => {
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

  it("a dict's key is named as the chart writes it", () => {
    const { program: p, inputs } = withInputs({ counts: {} }, []);
    const state = run(p, inputs, 1).state();
    const ctx = { program: p, state, frame: 0, pass: null };
    const key: Event = {
      type: "write",
      nodeId: "none",
      ref: { heap: 1, key: "s:a" },
      value: { t: "int", v: 1 },
    };
    expect(say(narrate(key, ctx))).toBe('counts at "a" is now 1');
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

  it("the line says the error where the run stops on it, a difference at its step, then the end, else the event", () => {
    const p = program([print(str("a")), print(str("b"))]);
    const runner = run(p, {}, 1);
    let first = runner.next();
    while (first.type !== "print") {
      if (first.type === "done" || first.type === "error") throw new Error("no print");
      first = runner.next();
    }
    const state = runner.state();
    const done = { type: "done", steps: 2, loops: 0 } as const;
    const error = {
      type: "error",
      error: { nodeId: "x", code: "E_INDEX", params: { index: 5, length: 3 } },
      steps: 2,
    } as const;
    const at = (position: Partial<Position>) => {
      const line = narratePosition(
        {
          step: 1,
          total: 2,
          outcome: done,
          lastEvent: first,
          state,
          frame: 0,
          pass: null,
          difference: null,
          ...position,
        },
        p,
      );
      return line && { text: say(line.narration), error: line.error };
    };
    expect(at({})).toEqual({ text: 'Printed "a"', error: false });
    expect(at({ difference: { step: 1, line: 1 } })).toEqual({
      text: "This printed line 1",
      error: false,
    });
    expect(at({ step: 2 })).toEqual({ text: "Finished in 2 steps", error: false });
    expect(at({ step: 2, difference: { step: 2 } })).toEqual({
      text: "The run ended here",
      error: false,
    });
    expect(at({ step: 2, outcome: error, difference: { step: 2 } })).toEqual({
      text: "Item 5 does not exist (length 3)",
      error: true,
    });
    expect(at({ step: 0, lastEvent: null, state: null })).toBeNull();
  });
});
