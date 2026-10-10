// L-59, L-65, L-66, N-12: kinds known before the program runs.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/nodes/testing";
import { isParseError, parse } from "@/python/parse";
import { chartOf, dataKind, exprKind, firstSetters, variableKinds } from "./kinds";
import type { Expr, Kind } from "./types";

const { assign, num, str, v, for_, print } = ast;

function expr(python: string): Expr {
  const parsed = parse(python, { classes: [], functions: ["f"] });
  if (isParseError(parsed)) throw new Error(python);
  return parsed;
}

const known = new Map<string, Kind>([
  ["n", "number"],
  ["s", "text"],
  ["ok", "truefalse"],
  ["xs", "list"],
  ["d", "dict"],
]);
const kind = (python: string) => exprKind(expr(python), known);

describe("kinds (L-59, L-65, L-66, N-12)", () => {
  it("N-12: literals, unary operators, and the builtins give their kinds", () => {
    expect(["1", "2.5", '"a"', "True", "None"].map(kind)).toEqual([
      "number",
      "number",
      "text",
      "truefalse",
      "none",
    ]);
    expect([kind("not n"), kind("-n")]).toEqual(["truefalse", "number"]);
    expect(["abs(s)", "int(s)", "float(n)", "random.randint(1, 6)", "str(n)"].map(kind)).toEqual([
      "number",
      "number",
      "number",
      "number",
      "text",
    ]);
    expect([kind("max(s, n)"), kind("min(n, s)"), kind("max(q, n)")]).toEqual([
      "text",
      "number",
      undefined,
    ]);
    expect(kind("f(1)")).toBeUndefined();
  });

  it("N-12: binop by its operator and, where they settle it, its inputs", () => {
    expect(["n < 1", "s == n", "n in xs"].map(kind)).toEqual([
      "truefalse",
      "truefalse",
      "truefalse",
    ]);
    expect(["ok and ok", "ok or n", "n and n"].map(kind)).toEqual([
      "truefalse",
      undefined,
      "number",
    ]);
    expect(["s + s", "n + n", "ok + ok", "n + s", "xs + xs"].map(kind)).toEqual([
      "text",
      "number",
      undefined,
      undefined,
      "list",
    ]);
    expect(["xs * n", "n * s", "n * n", "q * n"].map(kind)).toEqual([
      "list",
      "text",
      "number",
      "number",
    ]);
    expect(["n - 1", "q % 2", "n // 2", "n ** 2", "n / 2"].map(kind)).toEqual(
      Array(5).fill("number"),
    );
  });

  it("L-66: an input's declared kind, else its first assignment's, else its loop's; a parameter has none", () => {
    const p = program(
      [
        assign("total", num(0)),
        assign("total", str("now text")),
        for_("i", num(0), v("n"), [assign("twice", ast.bin("*", v("i"), num(2)))]),
        assign("unknown", ast.call("f", num(1))),
        assign("copy", v("total")),
        for_("k", num(0), num(2), []),
        assign("k", str("x")),
      ],
      {
        inputs: [
          { name: "n", kind: "number" },
          { name: "words", kind: "list" },
          { name: "point", kind: "object" },
          { name: "counts", kind: "dict" },
        ],
        functions: [{ id: "fun000000001", name: "f", params: ["x"], body: [print(v("x"))] }],
      },
    );
    expect(Object.fromEntries(variableKinds(p, "main"))).toEqual({
      n: "number",
      words: "list",
      point: "object",
      counts: "dict",
      total: "number",
      i: "number",
      twice: "number",
      copy: "number",
      k: "text",
    });
    expect(variableKinds(p, "fun000000001").size).toBe(0);
    expect(dataKind({ $float: 2 })).toBe("number");
  });

  it("names the statement that first sets each variable, and the chart a statement is in", () => {
    const first = assign("x", num(1));
    const inner = print(v("y"));
    const p = program([first, assign("x", num(2))], {
      functions: [{ id: "fun000000002", name: "g", params: ["y"], body: [inner] }],
    });
    expect(firstSetters(p, "main").get("x")).toBe(first);
    expect(chartOf(p, inner.id)).toBe("fun000000002");
    expect(chartOf(p, first.id)).toBe("main");
    expect(chartOf(p, tid())).toBe("main");
  });
});
