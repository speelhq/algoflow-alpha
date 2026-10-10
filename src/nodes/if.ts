// The `if` block: `if <cond>:` … `else:` (else omitted when empty; empty region → pass).
import { newId } from "@/lang/id";
import { decide } from "@/runtime/condition";
import { defineStmt } from "./types";

export const ifStmt = defineStmt<"if">({
  key: "if",
  category: "control",
  chart: { branch: { cond: "cond", yes: "then", no: "else" } },
  slots: [
    { name: "cond", role: "expr", required: true },
    { name: "then", role: "body" },
    { name: "else", role: "body" },
  ],
  create: () => ({
    id: newId(),
    kind: "if",
    cond: { id: newId(), kind: "empty" },
    then: [],
    else: [],
  }),
  *run(node, ctx) {
    const yes = yield* decide(node.cond, ctx);
    return yield* ctx.exec(yes ? node.then : node.else);
  },
  python: (node, ctx) => [
    `if ${ctx.expr(node.cond)}:`,
    ctx.block(node.then),
    ...(node.else.length > 0 ? ["else:", ctx.block(node.else)] : []),
  ],
});
