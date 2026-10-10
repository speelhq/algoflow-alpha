// U-110: Open in Playground; L-53: Export's file name and Import's validation.
import { describe, expect, it } from "vitest";
import { ast, program, withInputs } from "@/nodes/testing";
import { emit } from "@/python/emit";
import { exportName, importedProgram, playgroundCopy } from "./programs";

const { print, v } = ast;

describe("whole-program actions", () => {
  it("U-110, E-03: each input becomes an assignment of the case's value, titled as asked", () => {
    const made = withInputs({ n: 15, name: "Ada" }, [print(v("n"), v("name"))]);
    const copy = playgroundCopy(made.program, "FizzBuzz", made.inputs);
    expect(copy.title).toBe("FizzBuzz");
    expect(copy.inputs).toEqual([]);
    expect(emit(copy, {}).code).toBe(emit(made.program, made.inputs).code);
    expect(copy.main).toHaveLength(3);
  });

  it("L-53: Export writes <title>.algoflow.json, an empty title as the untitled name", () => {
    expect(exportName("Squares", "Untitled")).toBe("Squares.algoflow.json");
    expect(exportName("  ", "Untitled")).toBe("Untitled.algoflow.json");
  });

  it("L-53: Import accepts a program that migrates and rejects anything else", () => {
    const p = program([print(v("x"))]);
    expect(importedProgram(JSON.stringify(p))).toEqual(p);
    expect(importedProgram("{nope")).toBeUndefined();
    expect(importedProgram(JSON.stringify({ version: 9 }))).toBeUndefined();
  });
});
