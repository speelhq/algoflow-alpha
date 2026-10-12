// Data (JSON form) ⇄ Value/heap; expectation equality.
import { isRecord } from "./record";
import type { Data, Heap, HeapEntry, HeapId, Id, Value } from "./types";

const INT_KEY = "$int:";

/**
 * The largest `int` magnitude: a double holds every integer up to 2^53, but 2^53 is also what
 * 2^53 + 1 rounds to, so the range stops below it.
 */
const INT_MAX = 2 ** 53 - 1;

/** Whether `n` is an `int`: an integer within the int range; any other number is a float. */
export function fitsInt(n: number): boolean {
  return Number.isInteger(n) && Math.abs(n) <= INT_MAX;
}

/** A float: a fractional number, or the `{ $float: n }` form of an integral one. */
export function isFloatData(data: Data): data is number | { $float: number } {
  if (typeof data === "number") return !Number.isInteger(data);
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    "$float" in data &&
    typeof data.$float === "number"
  );
}

/** Why a number is not canonical: not finite, or an integer beyond the int range. */
function numberError(n: number): string | undefined {
  if (!Number.isFinite(n)) return "expected a finite number";
  return Number.isInteger(n) && !fitsInt(n)
    ? "expected an integer within the int range"
    : undefined;
}

/**
 * Why a dict key is not canonical: `$cls`, which marks an object no block constructs, or a
 * `$int:` key that is no integer within the int range as Python writes it (no `-0`).
 */
function keyError(key: string): string | undefined {
  if (key === "$cls") return "expected no object: no block constructs one";
  if (!key.startsWith(INT_KEY)) return undefined;
  const text = key.slice(INT_KEY.length);
  return /^(0|-?[1-9]\d*)$/.test(text) && fitsInt(Number(text))
    ? undefined
    : "expected a $int: key as Python writes an int in the int range";
}

/** Where a JSON value fails to be canonical `Data`, as a path below it, and why. */
export type DataFault = { at: string; message: string };

function faultAt(json: unknown, at: string): DataFault | undefined {
  if (typeof json === "number") {
    const message = numberError(json);
    return message === undefined ? undefined : { at, message };
  }
  if (json === null || typeof json === "string" || typeof json === "boolean") return undefined;
  if (Array.isArray(json)) {
    for (const [i, item] of json.entries()) {
      const fault = faultAt(item, `${at}[${i}]`);
      if (fault) return fault;
    }
    return undefined;
  }
  if (!isRecord(json)) return { at, message: "expected Data" };
  if ("$float" in json) {
    const only = Object.keys(json).length === 1 && typeof json.$float === "number";
    return only && Number.isFinite(json.$float)
      ? undefined
      : { at, message: "expected { $float: n }, n a finite number" };
  }
  for (const [key, item] of Object.entries(json)) {
    const message = keyError(key);
    const where = `${at}[${JSON.stringify(key)}]`;
    if (message !== undefined) return { at: where, message };
    const fault = faultAt(item, where);
    if (fault) return fault;
  }
  return undefined;
}

/** Where a JSON value fails to be canonical `Data`, and why; undefined when it is canonical. */
export function dataError(json: unknown): DataFault | undefined {
  return faultAt(json, "");
}

function alloc(heap: Heap, entry: HeapEntry): HeapId {
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

/** The int or the text a `Data` dict key stands for: `$int:3` is 3, any other key its text. */
export function dataKey(key: string): number | string {
  return key.startsWith(INT_KEY) ? Number(key.slice(INT_KEY.length)) : key;
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

/** A value from canonical `Data`; other `Data` is a caller's error. */
export function toValue(data: Data, heap: Heap): Value {
  if (typeof data === "number") {
    const message = numberError(data);
    if (message !== undefined) throw new Error(`toValue: ${data}: ${message}`);
    return Number.isInteger(data) ? { t: "int", v: data } : { t: "float", v: data };
  }
  if (typeof data === "string") return { t: "str", v: data };
  if (typeof data === "boolean") return { t: "bool", v: data };
  if (data === null) return { t: "none" };
  if (Array.isArray(data)) {
    const items = data.map((item) => toValue(item, heap));
    return { t: "list", ref: alloc(heap, { kind: "list", items }) };
  }
  if (isFloatData(data)) return { t: "float", v: floatOf(data) };
  const entries = new Map<string, Value>();
  for (const [key, item] of Object.entries(data)) {
    const message = keyError(key);
    if (message !== undefined) throw new Error(`toValue: ${key}: ${message}`);
    const stands = dataKey(key);
    entries.set(typeof stands === "number" ? `i:${stands}` : `s:${stands}`, toValue(item, heap));
  }
  return { t: "dict", ref: alloc(heap, { kind: "dict", entries }) };
}

export function toData(value: Value, heap: Heap): Data {
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
    case "dict": {
      const entry = heap.get(value.ref);
      if (!entry) throw new Error(`toData: dangling heap ref ${value.ref}`);
      return entryToData(entry, heap);
    }
  }
}

function entryToData(entry: HeapEntry, heap: Heap): Data {
  if (entry.kind === "list") return entry.items.map((item) => toData(item, heap));
  const out: Record<string, Data> = {};
  for (const [key, item] of entry.entries) {
    out[key.startsWith("i:") ? `${INT_KEY}${key.slice(2)}` : key.slice(2)] = toData(item, heap);
  }
  return out;
}

const FLOAT_TOLERANCE = 1e-6;

/** The number a float holds, in either form. */
export function floatOf(data: number | { $float: number }): number {
  return typeof data === "number" ? data : data.$float;
}

/** Test equality: ints exactly, floats within 1e-6, containers structurally. */
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
  const eKeys = Object.keys(expected);
  const aKeys = Object.keys(actual);
  if (eKeys.length !== aKeys.length) return false;
  const actualRecord = actual as Record<string, Data>;
  return eKeys.every(
    (key) =>
      key in actualRecord &&
      dataEquals((expected as Record<string, Data>)[key] ?? null, actualRecord[key] ?? null),
  );
}
