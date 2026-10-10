// Element access shared by the blocks that read or write
// list items, dict entries, and object fields.
import { dictKey } from "@/lang/data";
import type { HeapId, NodeId, Value } from "@/lang/types";
import type { RunContext } from "@/nodes/types";
import { entryOf, typeName } from "./values";

/** `E_TYPE` with the operand type names. */
export function typeError(nodeId: NodeId, left: Value, right: Value, ctx: RunContext): never {
  return ctx.fail(nodeId, "E_TYPE", {
    left: typeName(left, ctx.heap),
    right: typeName(right, ctx.heap),
  });
}

export function asList(
  list: Value,
  nodeId: NodeId,
  ctx: RunContext,
  other: Value,
): { ref: HeapId; items: Value[] } {
  if (list.t !== "list") {
    return ctx.fail(nodeId, "E_TYPE", {
      left: typeName(list, ctx.heap),
      right: typeName(other, ctx.heap),
    });
  }
  const entry = entryOf(ctx.heap, list.ref);
  if (entry.kind !== "list") throw new Error("list ref is not a list");
  return { ref: list.ref, items: entry.items };
}

/** An int index, negative from the end; out of range → E_INDEX. */
export function listIndex(items: Value[], index: Value, nodeId: NodeId, ctx: RunContext): number {
  if (index.t !== "int") {
    return ctx.fail(nodeId, "E_TYPE", { left: "list", right: typeName(index, ctx.heap) });
  }
  const i = index.v < 0 ? items.length + index.v : index.v;
  if (i < 0 || i >= items.length) {
    return ctx.fail(nodeId, "E_INDEX", { index: index.v, length: items.length });
  }
  return i;
}

export function asDict(
  dict: Value,
  nodeId: NodeId,
  ctx: RunContext,
  other: Value,
): { ref: HeapId; entries: Map<string, Value> } {
  if (dict.t !== "dict") {
    return ctx.fail(nodeId, "E_TYPE", {
      left: typeName(dict, ctx.heap),
      right: typeName(other, ctx.heap),
    });
  }
  const entry = entryOf(ctx.heap, dict.ref);
  if (entry.kind !== "dict") throw new Error("dict ref is not a dict");
  return { ref: dict.ref, entries: entry.entries };
}

/** Keys are int or str. */
export function dictKeyOf(key: Value, nodeId: NodeId, ctx: RunContext): string {
  const encoded = dictKey(key);
  if (encoded === undefined) {
    return ctx.fail(nodeId, "E_TYPE", { left: "dict", right: typeName(key, ctx.heap) });
  }
  return encoded;
}

export function asObject(
  obj: Value,
  nodeId: NodeId,
  ctx: RunContext,
  field: string,
): { ref: HeapId; cls: string; fields: Map<string, Value> } {
  if (obj.t !== "obj") {
    return ctx.fail(nodeId, "E_FIELD", { cls: typeName(obj, ctx.heap), field });
  }
  const entry = entryOf(ctx.heap, obj.ref);
  if (entry.kind !== "obj") throw new Error("obj ref is not an object");
  return { ref: obj.ref, cls: entry.cls, fields: entry.fields };
}
