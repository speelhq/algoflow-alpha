// The `num` block: `raw` is the source text; float when raw has `.`, `e`, or `E`.
import { newId } from "@/lang/id";
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
  // A stored literal outside the int range is a float, as a result is.
  *run(node) {
    return makeNumber(node.value, node.float);
  },
  python: (node) => node.raw,
  text: (node) => node.raw, // the canvas shows the literal as typed
  kind: () => "number",
});
