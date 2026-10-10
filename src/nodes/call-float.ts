// The builtin `float`: numbers, numeric text, `True` → 1.0.
import { defineBuiltin } from "./builtin";

const NUMBER = /^\s*[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)\s*$/;

export const floatCall = defineBuiltin({
  name: "float",
  category: "basic",
  params: ["x"],
  kind: () => "number",
  menu: [{ name: "", group: "convert", on: ["number", "text"] }],
  evaluate([x = { t: "none" }], node, ctx) {
    switch (x.t) {
      case "int":
      case "float":
        return { t: "float", v: x.v };
      case "bool":
        return { t: "float", v: x.v ? 1 : 0 };
      case "str":
        if (NUMBER.test(x.v)) return { t: "float", v: Number(x.v.trim()) };
        return ctx.textError(node, x.v);
      default:
        return ctx.valueError(node, x);
    }
  },
});
