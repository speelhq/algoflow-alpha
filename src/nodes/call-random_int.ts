// The builtin `random_int`: an int drawn from mulberry32, both bounds included; the
// emitted file imports `random`.
import { typeName } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const randomInt = defineBuiltin({
  name: "random_int",
  category: "basic",
  params: ["a", "b"],
  kind: () => "number",
  menu: [{ name: "", group: "calculate" }],
  python: "random.randint",
  aliases: ["random.randint"],
  imports: "random",
  evaluate([a = { t: "none" }, b = { t: "none" }], node, ctx) {
    if (a.t !== "int" || b.t !== "int") {
      return ctx.fail(node.id, "E_TYPE", {
        left: typeName(a, ctx.heap),
        right: typeName(b, ctx.heap),
      });
    }
    // CPython raises ValueError("empty range") when a > b.
    if (a.v > b.v) return ctx.fail(node.id, "E_EMPTY_RANGE", { a: a.v, b: b.v });
    return { t: "int", v: ctx.random.int(a.v, b.v) };
  },
});
