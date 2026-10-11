// G-01: the number literals Python takes; G-07: an int literal stays within the int range (L-68).
import { describe, expect, it } from "vitest";
import { numberLiteral } from "./number";

describe("numberLiteral (G-01, G-07)", () => {
  it("reads an int, and a float written with `.`, `e`, or `E`", () => {
    expect(numberLiteral("0")).toEqual({ value: 0, float: false });
    expect(numberLiteral("00")).toEqual({ value: 0, float: false });
    expect(numberLiteral("42")).toEqual({ value: 42, float: false });
    expect(numberLiteral("2.0")).toEqual({ value: 2, float: true });
    expect(numberLiteral(".5")).toEqual({ value: 0.5, float: true });
    expect(numberLiteral("1e3")).toEqual({ value: 1000, float: true });
    expect(numberLiteral("07.5")).toEqual({ value: 7.5, float: true });
  });

  it("refuses what Python rejects and what is no single literal", () => {
    for (const raw of ["07", "0777", "", "1.2.3", "-3", "1_000", "0x1f", " 1", "1 ", "e3"]) {
      expect(numberLiteral(raw), raw).toBeUndefined();
    }
  });

  it("G-07: an int literal ends at 2^53 − 1; a float literal has no such bound", () => {
    expect(numberLiteral("9007199254740991")).toEqual({ value: 2 ** 53 - 1, float: false });
    expect(numberLiteral("9007199254740992")).toBeUndefined();
    expect(numberLiteral("9007199254740992.0")).toEqual({ value: 2 ** 53, float: true });
  });
});
