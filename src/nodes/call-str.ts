// The builtin `str`: a value's text form.
import { str as text } from "@/runtime/values";
import { KINDS } from "@/lang/types";
import { defineBuiltin } from "./builtin";

export const strCall = defineBuiltin({
  name: "str",
  category: "basic",
  params: [{ name: "x" }],
  kind: () => "text",
  menu: [{ name: "", group: "convert", on: KINDS }],
  evaluate([x = { t: "none" }], _node, ctx) {
    return { t: "str", v: text(x, ctx.heap) };
  },
});
