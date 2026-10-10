// The builtin `abs`
import { isNumber, makeNumber } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const abs = defineBuiltin({
  name: "abs",
  category: "basic",
  params: ["x"],
  kind: () => "number",
  menu: [{ name: "", group: "calculate", on: ["number"] }],
  evaluate([x = { t: "none" }], node, ctx) {
    if (!isNumber(x)) return ctx.valueError(node, x);
    return makeNumber(Math.abs(x.v), x.t === "float");
  },
});
