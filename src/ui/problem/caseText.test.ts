// A case reads as its inputs, values written as the blocks write them.
import { describe, expect, it } from "vitest";
import { caseText } from "./caseText";

describe("caseText", () => {
  it("joins every input as name = value", () => {
    expect(caseText({ n: 15 })).toBe("n = 15");
    expect(caseText({ a: 3, b: 9, c: 5 })).toBe("a = 3, b = 9, c = 5");
  });

  it("writes texts in quotes and booleans and none as the blocks do", () => {
    expect(caseText({ name: "" })).toBe('name = ""');
    expect(caseText({ ok: true, x: null, xs: [1, 2] })).toBe("ok = true, x = none, xs = [1, 2]");
  });
});
