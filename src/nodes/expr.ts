// The `expr` block: an expression evaluated for its effect (method statements wrap one).
import { newId } from "@/lang/id";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const exprStmt = defineStmt<"expr">({
  key: "expr",
  category: "basic",
  // The menu offers it only as method statements and calls.
  hidden: true,
  slots: [{ name: "expr", role: "expr", required: true }],
  create: () => ({ id: newId(), kind: "expr", expr: emptyExpr() }),
  *run(node, ctx) {
    yield* ctx.eval(node.expr);
    return undefined;
  },
  python: (node, ctx) => [ctx.expr(node.expr)],
});
