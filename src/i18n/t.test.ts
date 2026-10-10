import { afterEach, describe, expect, it, vi } from "vitest";
import { flatten } from "./flatten";
import { errorText, getLocale, interpolate, setLocale, t, type MessageKey } from "./t";

describe("t (U-71, U-73)", () => {
  afterEach(() => {
    setLocale("en");
    vi.restoreAllMocks();
  });

  it("returns the en text for a nested key", () => {
    expect(t("app.name")).toBe("AlgoFlow");
    expect(t("node.for.label")).toBe("For loop");
  });

  it("interpolates {name} params and leaves unknown placeholders alone", () => {
    expect(t("error.E_KEY", { key: 7 })).toBe("Key 7 does not exist");
    expect(interpolate("{a} and {b}", { a: "x" })).toBe("x and {b}");
  });

  it("does not read placeholders from Object.prototype", () => {
    expect(interpolate("{toString} {constructor}", {})).toBe("{toString} {constructor}");
  });

  it("U-107: a message writes its op parameter as the label of that block", () => {
    expect(errorText({ code: "E_VALUE", params: { op: "call:abs", type: "str" } })).toBe(
      "Absolute value cannot be used on str",
    );
    expect(errorText({ code: "E_NUMBER_TEXT", params: { op: "call:int", text: "4.2" } })).toBe(
      'As whole number cannot read the text "4.2"',
    );
    expect(errorText({ code: "E_EMPTY_RANGE", params: { a: 5, b: 1 } })).toBe(
      "There is no whole number from 5 to 1",
    );
  });

  it("returns the key itself for an unknown key and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(t("nope.missing" as MessageKey)).toBe("nope.missing");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("falls back to en for a key the ja catalog lacks", () => {
    setLocale("ja");
    expect(getLocale()).toBe("ja");
    expect(t("app.name")).toBe("AlgoFlow");
  });

  it("flatten produces dotted keys and rejects non-string leaves", () => {
    expect(flatten({ a: { b: "x" }, c: "y" })).toEqual({ "a.b": "x", c: "y" });
    expect(() => flatten({ a: 1 })).toThrow(/non-string leaf/);
  });
});
