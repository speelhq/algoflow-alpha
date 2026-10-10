// Data (JSON form) ⇄ Value/heap; expectation equality.
import type { Data, Heap, HeapEntry, HeapId, Id, Value } from "./types";

const INT_KEY = "$int:";

export function isFloatData(data: Data): data is number | { $float: number } {
  if (typeof data === "number") return !Number.isInteger(data);
  return typeof data === "object" && data !== null && !Array.isArray(data) && "$float" in data;
}

function isObjectData(data: Data): data is { $cls: string; [field: string]: Data } {
  return typeof data === "object" && data !== null && !Array.isArray(data) && "$cls" in data;
}

export function alloc(heap: Heap, entry: HeapEntry): HeapId {
  const id = heap.size + 1;
  heap.set(id, entry);
  return id;
}

/** Dict keys are `int` or `str`; the heap encodes them as "i:3" / "s:ab". */
export function dictKey(value: Value): string | undefined {
  if (value.t === "int") return `i:${value.v}`;
  if (value.t === "str") return `s:${value.v}`;
  return undefined;
}

export function keyValue(key: string): Value {
  return key.startsWith("i:")
    ? { t: "int", v: Number(key.slice(2)) }
    : { t: "str", v: key.slice(2) };
}

/** The value `inputs` gives input `name`; a declared input without one is a caller's error. */
export function inputValue(inputs: Readonly<Record<Id, Data>>, name: Id): Data {
  const data = inputs[name];
  if (!Object.hasOwn(inputs, name) || data === undefined) {
    throw new Error(`no value for input ${name}`);
  }
  return data;
}

export function toValue(data: Data, heap: Heap): Value {
  if (typeof data === "number") {
    return Number.isInteger(data) ? { t: "int", v: data } : { t: "float", v: data };
  }
  if (typeof data === "string") return { t: "str", v: data };
  if (typeof data === "boolean") return { t: "bool", v: data };
  if (data === null) return { t: "none" };
  if (Array.isArray(data)) {
    const items = data.map((item) => toValue(item, heap));
    return { t: "list", ref: alloc(heap, { kind: "list", items }) };
  }
  if ("$float" in data && typeof data.$float === "number") {
    return { t: "float", v: data.$float };
  }
  if (isObjectData(data)) {
    const fields = new Map<string, Value>();
    for (const [name, field] of Object.entries(data)) {
      if (name === "$cls" || name === "$id") continue;
      fields.set(name, toValue(field, heap));
    }
    return { t: "obj", ref: alloc(heap, { kind: "obj", cls: data.$cls, fields }) };
  }
  const entries = new Map<string, Value>();
  for (const [key, item] of Object.entries(data)) {
    const encoded = key.startsWith(INT_KEY) ? `i:${key.slice(INT_KEY.length)}` : `s:${key}`;
    entries.set(encoded, toValue(item, heap));
  }
  return { t: "dict", ref: alloc(heap, { kind: "dict", entries }) };
}

export type ToDataContext = { ids: Map<HeapId, number>; visiting: Set<HeapId> };

export function toData(
  value: Value,
  heap: Heap,
  ctx: ToDataContext = { ids: new Map(), visiting: new Set() },
): Data {
  switch (value.t) {
    case "int":
      return value.v;
    case "float":
      return Number.isInteger(value.v) ? { $float: value.v } : value.v;
    case "str":
      return value.v;
    case "bool":
      return value.v;
    case "none":
      return null;
    case "list":
    case "dict":
    case "obj": {
      const entry = heap.get(value.ref);
      if (!entry) throw new Error(`toData: dangling heap ref ${value.ref}`);
      return entryToData(value.ref, entry, heap, ctx);
    }
  }
}

function entryToData(ref: HeapId, entry: HeapEntry, heap: Heap, ctx: ToDataContext): Data {
  if (entry.kind === "list") return entry.items.map((item) => toData(item, heap, ctx));
  if (entry.kind === "dict") {
    const out: Record<string, Data> = {};
    for (const [key, item] of entry.entries) {
      out[key.startsWith("i:") ? `${INT_KEY}${key.slice(2)}` : key.slice(2)] = toData(
        item,
        heap,
        ctx,
      );
    }
    return out;
  }
  // Objects are numbered in first-reach order; a repeat carries the same $id.
  let id = ctx.ids.get(ref);
  if (id === undefined) {
    id = ctx.ids.size + 1;
    ctx.ids.set(ref, id);
  }
  const out: Record<string, Data> = { $cls: entry.cls, $id: id };
  if (ctx.visiting.has(ref)) return out; // a cycle: reference only
  ctx.visiting.add(ref);
  for (const [name, field] of entry.fields) out[name] = toData(field, heap, ctx);
  ctx.visiting.delete(ref);
  return out;
}

const FLOAT_TOLERANCE = 1e-6;

function floatOf(data: number | { $float: number }): number {
  return typeof data === "number" ? data : data.$float;
}

/** Test equality: ints exactly, floats within 1e-6, containers structurally, objects ignoring identity. */
export function dataEquals(expected: Data, actual: Data): boolean {
  if (isFloatData(expected) || isFloatData(actual)) {
    const e = typeof expected === "number" || isFloatData(expected) ? floatOf(expected) : NaN;
    const a = typeof actual === "number" || isFloatData(actual) ? floatOf(actual) : NaN;
    return isFloatData(expected) === isFloatData(actual) && Math.abs(e - a) <= FLOAT_TOLERANCE;
  }
  if (typeof expected !== typeof actual) return false;
  if (expected === null || typeof expected !== "object") return expected === actual;
  if (actual === null || typeof actual !== "object") return false;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    return (
      expected.length === actual.length &&
      expected.every((item, i) => dataEquals(item, actual[i] ?? null))
    );
  }
  const eKeys = Object.keys(expected).filter((k) => k !== "$id");
  const aKeys = Object.keys(actual).filter((k) => k !== "$id");
  if (eKeys.length !== aKeys.length) return false;
  const actualRecord = actual as Record<string, Data>;
  return eKeys.every(
    (key) =>
      key in actualRecord &&
      dataEquals((expected as Record<string, Data>)[key] ?? null, actualRecord[key] ?? null),
  );
}
