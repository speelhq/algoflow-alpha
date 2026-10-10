// The builtin `int`: truncates floats, parses integer text, `True` → 1.
import { makeNumber } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

const INTEGER = /^\s*[+-]?\d+\s*$/;

export const intCall = defineBuiltin({
  name: "int",
  category: "basic",
  params: ["x"],
  kind: () => "number",
  menu: [{ name: "", group: "convert", on: ["number", "text"] }],
  evaluate([x = { t: "none" }], node, ctx) {
    switch (x.t) {
      case "int":
        return x;
      case "float":
        return makeNumber(Math.trunc(x.v), false);
      case "bool":
        return { t: "int", v: x.v ? 1 : 0 };
      case "str":
        if (INTEGER.test(x.v)) return makeNumber(Number(x.v.trim()), false);
        return ctx.textError(node, x.v);
      default:
        return ctx.valueError(node, x);
    }
  },
});
