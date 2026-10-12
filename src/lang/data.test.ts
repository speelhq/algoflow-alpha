import { describe, expect, it } from "vitest";
import { dataEquals, dataError, dataKey, inputValue, toData, toValue } from "./data";
import type { Data, Heap } from "./types";

function roundTrip(data: Data): Data {
  const heap: Heap = new Map();
  return toData(toValue(data, heap), heap);
}

describe("toValue / toData", () => {
  it("keeps int and float distinct", () => {
    const heap: Heap = new Map();
    expect(toValue(2, heap)).toEqual({ t: "int", v: 2 });
    expect(toValue(2.5, heap)).toEqual({ t: "float", v: 2.5 });
    expect(toValue({ $float: 2 }, heap)).toEqual({ t: "float", v: 2 });
    expect(roundTrip(2)).toBe(2);
    expect(roundTrip(2.5)).toBe(2.5);
    expect(roundTrip({ $float: 2 })).toEqual({ $float: 2 });
  });

  it("an integral Data number is an int within the range; beyond it, no value", () => {
    const heap: Heap = new Map();
    expect(toValue(2 ** 53 - 1, heap)).toEqual({ t: "int", v: 2 ** 53 - 1 });
    expect(toValue(-(2 ** 53 - 1), heap)).toEqual({ t: "int", v: -(2 ** 53 - 1) });
    expect(() => toValue(2 ** 53, heap)).toThrow("int range");
    expect(() => toValue(-(2 ** 53), heap)).toThrow("int range");
    expect(() => toValue({ "$int:9007199254740992": 1 }, heap)).toThrow("int range");
  });

  it("round-trips scalars", () => {
    expect(roundTrip("ab")).toBe("ab");
    expect(roundTrip(true)).toBe(true);
    expect(roundTrip(null)).toBeNull();
  });

  it("allocates lists and dicts on the heap with encoded keys", () => {
    const heap: Heap = new Map();
    const list = toValue([1, [2, 3]], heap);
    expect(list).toEqual({ t: "list", ref: 2 });
    expect(heap.get(1)).toEqual({
      kind: "list",
      items: [
        { t: "int", v: 2 },
        { t: "int", v: 3 },
      ],
    });
    const dict = toValue({ a: 1, "$int:3": "x" }, heap);
    expect(dict.t).toBe("dict");
    const entry = heap.get(3);
    expect(entry?.kind === "dict" && [...entry.entries.keys()]).toEqual(["s:a", "i:3"]);
    expect(roundTrip({ a: 1, "$int:3": "x" })).toEqual({ a: 1, "$int:3": "x" });
  });

  it("reads a dict key as the int or the text it stands for", () => {
    expect(dataKey("$int:3")).toBe(3);
    expect(dataKey("$int:-3")).toBe(-3);
    expect(dataKey("a")).toBe("a");
  });

  it("an object is no value, while no block constructs one", () => {
    expect(() => toValue({ $cls: "P", x: 1 }, new Map())).toThrow("no object");
  });
});

describe("dataEquals", () => {
  it("compares ints exactly and floats within 1e-6", () => {
    expect(dataEquals(55, 55)).toBe(true);
    expect(dataEquals(55, 56)).toBe(false);
    expect(dataEquals(14.003, 14.0030000004)).toBe(true);
    expect(dataEquals(14.003, 14.004)).toBe(false);
    expect(dataEquals({ $float: 2 }, { $float: 2 })).toBe(true);
  });

  it("does not confuse an int with a float", () => {
    expect(dataEquals(2, { $float: 2 })).toBe(false);
    expect(dataEquals({ $float: 2 }, 2)).toBe(false);
  });

  it("compares strings, booleans, none, lists, and dicts structurally", () => {
    expect(dataEquals("a", "a")).toBe(true);
    expect(dataEquals(true, false)).toBe(false);
    expect(dataEquals(null, null)).toBe(true);
    expect(dataEquals([1, [2]], [1, [2]])).toBe(true);
    expect(dataEquals([1, 2], [1])).toBe(false);
    expect(dataEquals({ a: 1 }, { a: 1 })).toBe(true);
    expect(dataEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(dataEquals([], {})).toBe(false);
  });
});

describe("inputValue", () => {
  it("gives an input's value, and fails for a declared input that has none", () => {
    expect(inputValue({ n: 0, s: "" }, "n")).toBe(0);
    expect(inputValue({ n: null }, "n")).toBeNull();
    expect(() => inputValue({}, "n")).toThrow(/no value for input n/);
    expect(() => inputValue({}, "toString")).toThrow(/no value for input toString/);
  });
});

describe("dataError", () => {
  it("accepts canonical Data", () => {
    for (const data of [
      0,
      -(2 ** 53 - 1),
      2.5,
      { $float: 2 },
      { $float: 1e300 },
      "x",
      true,
      null,
      [1, [2.5]],
      { "$int:-3": "a", b: [] },
    ]) {
      expect(dataError(data), JSON.stringify(data)).toBeUndefined();
    }
  });

  it("names where and why a value is not canonical", () => {
    expect(dataError(2 ** 53)).toEqual({
      at: "",
      message: "expected an integer within the int range",
    });
    expect(dataError([1, 2 ** 60])).toMatchObject({ at: "[1]" });
    expect(dataError({ a: { $float: "2" } })).toMatchObject({ at: '["a"]' });
    expect(dataError({ $float: 2, x: 1 })).toMatchObject({ at: "" });
    expect(dataError({ "$int:07": 1 })).toMatchObject({ at: '["$int:07"]' });
    expect(dataError({ "$int:-0": 1 })).toMatchObject({ at: '["$int:-0"]' });
    expect(dataError({ "$int:9007199254740992": 1 })).toMatchObject({
      at: '["$int:9007199254740992"]',
    });
    expect(dataError({ a: [Infinity] })).toMatchObject({ at: '["a"][0]' });
    expect(dataError(Number.NaN)).toMatchObject({ message: "expected a finite number" });
    expect(dataError(undefined)).toMatchObject({ message: "expected Data" });
  });

  it("names an object (`$cls`) where it is, while no block constructs one", () => {
    expect(dataError([{ $cls: "Node", next: null }])).toEqual({
      at: '[0]["$cls"]',
      message: "expected no object: no block constructs one",
    });
  });
});
