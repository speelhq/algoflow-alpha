// The `num` block: `raw` is the source text; float when raw has `.`, `e`, or `E`.
import { newId } from "@/lang/id";
import { numberLiteral } from "@/python/number";
import { makeNumber } from "@/runtime/values";
import { defineExpr } from "./types";

export const num = defineExpr<"num">({
  key: "num",
  category: "basic",
  slots: [{ name: "value", role: "text", required: true }],
  create: () => ({ id: newId(), kind: "num", value: 0, float: false, raw: "0" }),
  zeroLike: (node) => ({
    id: newId(),
    kind: "num",
    value: 0,
    float: node.kind === "num" && node.float,
    raw: node.kind === "num" && node.float ? "0.0" : "0",
  }),
  fieldsError: (fields) => {
    const literal = typeof fields.raw === "string" ? numberLiteral(fields.raw) : undefined;
    if (!literal) return { field: "raw", message: "expected a number literal within range" };
    if (literal.value !== fields.value) {
      return { field: "value", message: "expected the number raw writes" };
    }
    return literal.float === fields.float
      ? undefined
      : { field: "float", message: "expected whether raw writes a float" };
  },
  *run(node) {
    return makeNumber(node.value, node.float);
  },
  python: (node) => node.raw,
  text: (node) => node.raw, // the canvas shows the literal as typed
  kind: () => "number",
});
