import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, eventTypes, program, runAll, withInputs } from "./testing";

const { print, num, float, str, bool, none, bin, v } = ast;
const lines = (main: Parameters<typeof program>[0]) =>
  emit(program(main), {}).code.trimEnd().split("\n");

describe("print (nodes.md)", () => {
  it("N-03: emits `print(<a>, <b>)`", () => {
    expect(lines([print(str("Hello, "), v("name"))])).toEqual(['print("Hello, ", name)']);
    expect(lines([print()])).toEqual(["print()"]);
  });

  it("N-10 / L-29: joins str() forms with one space, emits a print event, appends to stdout", () => {
    const stmt = print(bool(true), none(), float(2), str("a b"), bin("/", num(1), num(4)));
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "print"]);
    expect(result.events[1]).toEqual({
      type: "print",
      nodeId: stmt.id,
      text: "True None 2.0 a b 0.25",
    });
    expect(result.stdout).toEqual(["True None 2.0 a b 0.25"]);
  });

  it("N-10: a list argument prints in repr form with single-quoted strings", () => {
    const made = withInputs({ xs: [1, "a", { $float: 2 }] }, [print(v("xs"))]);
    const result = runAll(made.program, made.inputs);
    expect(result.stdout).toEqual(["[1, 'a', 2.0]"]);
  });
});
