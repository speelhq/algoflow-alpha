import { describe, expect, it } from "vitest";
import { dataEquals, inputValue, toData, toValue } from "./data";
import type { Data, Heap } from "./types";

function roundTrip(data: Data): Data {
  const heap: Heap = new Map();
  return toData(toValue(data, heap), heap);
}

describe("L-06 toValue / toData", () => {
  it("keeps int and float distinct (L-07)", () => {
    const heap: Heap = new Map();
    expect(toValue(2, heap)).toEqual({ t: "int", v: 2 });
    expect(toValue(2.5, heap)).toEqual({ t: "float", v: 2.5 });
    expect(toValue({ $float: 2 }, heap)).toEqual({ t: "float", v: 2 });
    expect(roundTrip(2)).toBe(2);
    expect(roundTrip(2.5)).toBe(2.5);
    expect(roundTrip({ $float: 2 })).toEqual({ $float: 2 });
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

  it("numbers objects by first reach and repeats the same $id", () => {
    const heap: Heap = new Map();
    const a = toValue({ $cls: "Value", data: { $float: 2 }, prev: [] }, heap);
    const aRef = a.t === "obj" ? a.ref : -1;
    const holder = toValue([], heap);
    const items = heap.get(holder.t === "list" ? holder.ref : -1);
    if (items?.kind === "list") items.items.push(a, a);
    expect(toData(holder, heap)).toEqual([
      { $cls: "Value", $id: 1, data: { $float: 2 }, prev: [] },
      { $cls: "Value", $id: 1, data: { $float: 2 }, prev: [] },
    ]);
    expect(aRef).toBe(2);
  });

  it("drops $id when reading an object expectation", () => {
    const heap: Heap = new Map();
    const value = toValue({ $cls: "P", $id: 7, x: 1 }, heap);
    const entry = heap.get(value.t === "obj" ? value.ref : -1);
    expect(entry?.kind === "obj" && [...entry.fields.keys()]).toEqual(["x"]);
  });
});

describe("C-10 dataEquals", () => {
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

  it("compares objects by class, field set, and values, ignoring identity", () => {
    expect(dataEquals({ $cls: "V", $id: 1, x: 1 }, { $cls: "V", $id: 9, x: 1 })).toBe(true);
    expect(dataEquals({ $cls: "V", x: 1 }, { $cls: "W", x: 1 })).toBe(false);
    expect(dataEquals({ $cls: "V", x: 1 }, { $cls: "V", x: 1, y: 2 })).toBe(false);
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
