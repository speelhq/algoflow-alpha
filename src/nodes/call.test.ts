import { describe, expect, it } from "vitest";
import type { FunctionDef } from "@/lang/types";
import { emit, unparse } from "@/python/emit";
import { ast, eventTypes, program, runAll, varData } from "./testing";

const { call, num, bin, v, assign, ret, print } = ast;

const twice: FunctionDef = {
  id: "f0000000000f",
  name: "twice",
  params: ["x"],
  body: [ret(bin("*", v("x"), num(2)))],
};

describe("call (nodes.md)", () => {
  it("N-03: emits `<fn>(<args>)`", () => {
    expect(unparse(call("twice", num(3)))).toBe("twice(3)");
    expect(emit(program([assign("y", call("twice", num(3)))], { functions: [twice] })).code).toBe(
      "def twice(x):\n    return x * 2\n\n\ny = twice(3)\n",
    );
  });

  it("N-10 / R-14: call and return events around the body; the value comes back", () => {
    const stmt = assign("y", call("twice", num(3)));
    const result = runAll(program([stmt], { functions: [twice] }));
    expect(eventTypes(result.events)).toEqual(["enter", "call", "enter", "return", "write"]);
    expect(result.events[1]).toMatchObject({
      type: "call",
      fn: "twice",
      args: [{ t: "int", v: 3 }],
    });
    expect(result.events[3]).toMatchObject({
      type: "return",
      fn: "twice",
      value: { t: "int", v: 6 },
    });
    expect(varData(result, "y")).toBe(6);
    expect(result.state.frames).toHaveLength(1);
  });

  it("N-10 / L-28: a function without return yields None; depth over 200 → E_RECURSION", () => {
    const noReturn: FunctionDef = {
      id: "f0000000000g",
      name: "noop",
      params: [],
      body: [print(num(1))],
    };
    expect(
      varData(runAll(program([assign("r", call("noop"))], { functions: [noReturn] })), "r"),
    ).toBeNull();
    const forever: FunctionDef = {
      id: "f0000000000h",
      name: "down",
      params: ["n"],
      body: [ret(call("down", bin("+", v("n"), num(1))))],
    };
    const result = runAll(program([assign("r", call("down", num(0)))], { functions: [forever] }));
    expect(result.done).toMatchObject({ type: "error", error: { code: "E_RECURSION" } });
  });
});
