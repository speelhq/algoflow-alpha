import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { NODES } from "@/nodes/registry";
import { mulberry32 } from "@/runtime/random";
import { unparse } from "./emit";
import { isParseError, NO_DEFINITIONS, parse, type ParseError, type ParseScope } from "./parse";
import { BINOPS } from "./precedence";

function ok(text: string, scope: ParseScope = NO_DEFINITIONS): Expr {
  const result = parse(text, scope);
  if (isParseError(result))
    throw new Error(`unexpected error ${JSON.stringify(result)} for ${text}`);
  return result;
}

function err(text: string, scope: ParseScope = NO_DEFINITIONS): ParseError {
  const result = parse(text, scope);
  if (!isParseError(result))
    throw new Error(`expected an error for ${text}, got ${unparse(result)}`);
  return result;
}

describe("parse", () => {
  it("parses literals with raw number text and decoded strings", () => {
    expect(ok("1e3")).toMatchObject({ kind: "num", value: 1000, float: true, raw: "1e3" });
    expect(ok("42")).toMatchObject({ kind: "num", value: 42, float: false, raw: "42" });
    expect(ok(".5")).toMatchObject({ kind: "num", value: 0.5, float: true });
    expect(ok("'a\\nb'")).toMatchObject({ kind: "str", value: "a\nb" });
    expect(ok('"say \\"hi\\""')).toMatchObject({ kind: "str", value: 'say "hi"' });
    expect(ok("True")).toMatchObject({ kind: "bool", value: true });
    expect(ok("None")).toMatchObject({ kind: "none" });
    expect(ok("total")).toMatchObject({ kind: "var", name: "total" });
  });

  it("builds the grammar's precedence levels", () => {
    expect(ok("a or b and not c == d + e * -f ** 2")).toMatchObject({
      kind: "binop",
      op: "or",
      right: {
        op: "and",
        right: {
          kind: "unop",
          op: "not",
          operand: {
            op: "==",
            right: {
              op: "+",
              right: { op: "*", right: { kind: "unop", op: "neg", operand: { op: "**" } } },
            },
          },
        },
      },
    });
    expect(ok("a ** b ** c")).toMatchObject({ op: "**", right: { op: "**" } });
    expect(ok("a - b - c")).toMatchObject({ op: "-", left: { op: "-" } });
    expect(ok("(a + b) * c")).toMatchObject({ op: "*", left: { op: "+" } });
  });

  it("reports grammar forms whose block is not registered yet as E_PARSE_SYNTAX at their token", () => {
    // index, field, list, and dict have no registered block, so the registry says no.
    expect(err("xs[i + 1]")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(err("p.x")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(err("[1, 2]")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("1 + {}")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
  });

  it("rejects number text CPython rejects and decodes \\x escapes", () => {
    expect(err("0777")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("1 + 007")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
    expect(ok("00")).toMatchObject({ kind: "num", value: 0, raw: "00" });
    expect(ok("0.5")).toMatchObject({ kind: "num", value: 0.5 });
    expect(ok('"a\\x41\\x01"')).toMatchObject({ kind: "str", value: "aA" });
  });

  it("an int literal outside the int range is a syntax error at its token", () => {
    expect(ok("9007199254740991")).toMatchObject({ kind: "num", value: 2 ** 53 - 1, float: false });
    expect(err("1 + 9007199254740992")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
    expect(err("-9007199254740992")).toEqual({ code: "E_PARSE_SYNTAX", position: 1 });
    expect(ok("9007199254740993.0")).toMatchObject({ kind: "num", float: true });
  });

  it("gives every node an id and no mark of how it was made", () => {
    const expr = ok("a + b");
    expect(expr.id).toHaveLength(12);
    expect(Object.keys(expr).toSorted()).toEqual(["id", "kind", "left", "op", "right"]);
  });
});

describe("call resolution", () => {
  it("resolves a builtin or a user function by name, else E_UNKNOWN_CALL", () => {
    const scope = { functions: ["fib"] };
    expect(ok("abs(x)", scope)).toMatchObject({ kind: "call", fn: "abs" });
    expect(ok("fib(n)", scope)).toMatchObject({ kind: "call", fn: "fib" });
    expect(err("nope(1)", scope)).toEqual({
      code: "E_UNKNOWN_CALL",
      position: 0,
      params: { name: "nope" },
    });
    expect(err("1 + nope(1)", scope)).toMatchObject({ code: "E_UNKNOWN_CALL", position: 4 });
    // The name's token, whatever stands between it and the bracket.
    expect(err("1 + nope (1)", scope)).toMatchObject({ code: "E_UNKNOWN_CALL", position: 4 });
  });

  it("accepts the Python aliases of builtins", () => {
    expect(ok("random.randint(1, 6)")).toMatchObject({ kind: "call", fn: "random_int" });
    expect(unparse(ok("random.randint(1, 6)"))).toBe("random.randint(1, 6)");
  });

  it("an unknown method → E_UNKNOWN_CALL at the method name", () => {
    expect(err("xs.frobnicate(1)")).toEqual({
      code: "E_UNKNOWN_CALL",
      position: 3,
      params: { name: "frobnicate" },
    });
  });

  it("calling a non-name is a syntax error", () => {
    expect(err("(a + b)(1)")).toMatchObject({ code: "E_PARSE_SYNTAX", position: 7 });
  });
});

describe("errors carry a position", () => {
  it("chained comparison → E_PARSE_CHAIN at the second operator", () => {
    expect(err("a < b < c")).toEqual({ code: "E_PARSE_CHAIN", position: 6 });
    expect(err("1 == 2 == 3")).toEqual({ code: "E_PARSE_CHAIN", position: 7 });
    expect(err("x in xs in ys")).toEqual({ code: "E_PARSE_CHAIN", position: 8 });
  });

  it("other syntax errors → E_PARSE_SYNTAX", () => {
    expect(err("a +")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("(a")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(err('"open')).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("a b")).toEqual({ code: "E_PARSE_SYNTAX", position: 2 });
    expect(err("1 +* 2")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("@")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("")).toEqual({ code: "E_PARSE_SYNTAX", position: 0 });
    expect(err("not")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("xs[")).toEqual({ code: "E_PARSE_SYNTAX", position: 3 });
    expect(err("{1: }")).toEqual({ code: "E_PARSE_SYNTAX", position: 4 });
  });
});

// ---------------------------------------------------------------- property test

const BUILTINS = [...NODES.values()].filter((def) => def.key.startsWith("call:"));
const NAMES = ["a", "b", "c", "n", "total", "xs"];
const RAWS = ["0", "1", "2", "42", "1.5", "2.0", "1e3", "0.25"];
const STRINGS = ["", "a", "a b", 'say "hi"', "line\n", "tab\t", "back\\slash", "it's"];

function generator(seed: number) {
  const rand = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(rand() * items.length)];
    if (item === undefined) throw new Error("empty");
    return item;
  };
  let n = 0;
  const id = () => `g${String((n += 1)).padStart(11, "0")}`;
  const gen = (depth: number): Expr => {
    const leaf = depth <= 0 || rand() < 0.3;
    const choice = Math.floor(rand() * (leaf ? 5 : 8));
    switch (choice) {
      case 0: {
        const raw = pick(RAWS);
        return { id: id(), kind: "num", value: Number(raw), float: /[.eE]/.test(raw), raw };
      }
      case 1:
        return { id: id(), kind: "str", value: pick(STRINGS) };
      case 2:
        return { id: id(), kind: "bool", value: rand() < 0.5 };
      case 3:
        return { id: id(), kind: "none" };
      case 4:
        return { id: id(), kind: "var", name: pick(NAMES) };
      case 5:
        return {
          id: id(),
          kind: "binop",
          op: pick(BINOPS),
          left: gen(depth - 1),
          right: gen(depth - 1),
        };
      case 6:
        return {
          id: id(),
          kind: "unop",
          op: rand() < 0.5 ? "neg" : "not",
          operand: gen(depth - 1),
        };
      default: {
        const def = pick(BUILTINS);
        return {
          id: id(),
          kind: "call",
          fn: def.key.slice(5),
          args: (def.params ?? []).map(() => gen(depth - 1)),
        };
      }
    }
  };
  return () => gen(4);
}

/** An expression with every node id removed, for comparing structure alone. */
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "id")
      .map(([key, field]) => [key, withoutIds(field)]),
  );
}

describe("parse(unparse(e)) is e apart from ids", () => {
  it("holds for 1,000 generated expressions, so the text is a fixed point", () => {
    const next = generator(20260903);
    for (let i = 0; i < 1000; i += 1) {
      const expr = next();
      const text = unparse(expr);
      const parsed = parse(text, NO_DEFINITIONS);
      if (isParseError(parsed)) throw new Error(`case ${i}: ${text} → ${JSON.stringify(parsed)}`);
      expect(withoutIds(parsed), `case ${i}: ${text}`).toEqual(withoutIds(expr));
      expect(unparse(parsed), `case ${i}`).toBe(text);
    }
  });
});
