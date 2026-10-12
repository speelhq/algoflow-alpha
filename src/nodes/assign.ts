// The `assign` block: `<target> = <value>` and its `write` event; a target may be an
// item or an entry.
import { newId } from "@/lang/id";
import { asDict, asList, dictKeyOf, listIndex } from "@/runtime/access";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const assign = defineStmt<"assign">({
  key: "assign",
  category: "basic",
  slots: [
    { name: "target", role: "target", required: true },
    { name: "value", role: "expr", required: true },
  ],
  create: () => ({
    id: newId(),
    kind: "assign",
    target: { kind: "var", name: "" },
    value: emptyExpr(),
  }),
  *run(node, ctx) {
    const value = yield* ctx.eval(node.value);
    const target = node.target;
    switch (target.kind) {
      case "var":
        ctx.set(target.name, value);
        yield { type: "write", nodeId: node.id, ref: { var: target.name }, value };
        return undefined;
      case "index": {
        // Python evaluates the container before the index.
        const listValue = yield* ctx.eval(target.list);
        const index = yield* ctx.eval(target.index);
        const list = asList(listValue, node.id, ctx, index);
        const i = listIndex(list.items, index, node.id, ctx);
        list.items[i] = value;
        yield { type: "write", nodeId: node.id, ref: { heap: list.ref, index: i }, value };
        return undefined;
      }
      case "key": {
        const dictValue = yield* ctx.eval(target.dict);
        const key = yield* ctx.eval(target.key);
        const dict = asDict(dictValue, node.id, ctx, key);
        const encoded = dictKeyOf(key, node.id, ctx);
        dict.entries.set(encoded, value);
        yield { type: "write", nodeId: node.id, ref: { heap: dict.ref, key: encoded }, value };
        return undefined;
      }
    }
  },
  python: (node, ctx) => [`${ctx.target(node.target)} = ${ctx.expr(node.value)}`],
  // `create {target} and set it to {value}` when this statement creates the variable.
  form: (_node, ctx) => (ctx.creates ? "Create" : ""),
});
