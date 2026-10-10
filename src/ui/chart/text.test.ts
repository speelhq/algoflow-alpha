// N-08, N-09, U-33, U-51: node text as the chart writes it.
import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { ast, program } from "@/nodes/testing";
import { isParseError, parse } from "@/python/parse";
import {
  capitalise,
  drawn,
  exprParts,
  exprText,
  generatedText,
  inputParts,
  joinParts,
  questionParts,
  sentence,
  sentenceParts,
} from "./text";

const { assign, num, str, bool, bin, neg, not, v, print, for_, if_, call, ret, empty } = ast;

function expr(python: string): Expr {
  const parsed = parse(python, { classes: [], functions: ["f"] });
  if (isParseError(parsed)) throw new Error(python);
  return parsed;
}

describe("sentence (N-08)", () => {
  it("renders statements from their template, with the create form of a first assignment", () => {
    const first = assign("total", num(0));
    const again = assign("total", bin("+", v("total"), v("i")));
    const p = program([first, again, print(str("a"), v("total")), ret()]);
    expect(sentence(first, p)).toBe("create total and set it to 0");
    expect(sentence(again, p)).toBe("set total to total + i");
    expect(p.main.slice(2).map((stmt) => sentence(stmt, p))).toEqual([
      'print "a", total',
      "return",
    ]);
    expect(capitalise(sentence(again, p))).toBe("Set total to total + i");
  });

  it("writes only school symbols, and names builtin arguments by parameter", () => {
    expect(exprText(bin("*", num(2, "2.50"), bin("/", v("a"), v("b"))))).toBe("2.50 × (a ÷ b)");
    expect(
      ["a - b", "a == b", "a != b", "a <= b", "a >= b", "a < b"].map((t) => exprText(expr(t))),
    ).toEqual(["a − b", "a = b", "a ≠ b", "a ≤ b", "a ≥ b", "a < b"]);
    expect(exprText(bool(false))).toBe("false");
    expect(exprText(neg(v("x")))).toBe("−x");
    expect(exprText(call("f", num(1), v("n")))).toBe("f(1, n)");
  });

  it("writes %, //, **, and in in words", () => {
    expect(exprText(expr("i % 15"))).toBe("remainder of i divided by 15");
    expect(exprText(expr("a // b"))).toBe("whole-number quotient of a divided by b");
    expect(exprText(expr("2 ** 3"))).toBe("2 to the power of 3");
    expect(exprText(expr("x in nums"))).toBe("x is in nums");
  });

  it("parenthesises operators among themselves exactly where the emitter would (E-05)", () => {
    expect(exprText(expr("(a + b) * c"))).toBe("(a + b) × c");
    expect(exprText(expr("a + b * c"))).toBe("a + b × c");
    expect(exprText(expr("a - (b - c)"))).toBe("a − (b − c)");
    expect(exprText(expr("-(a + b)"))).toBe("−(a + b)");
    expect(exprText(expr("a < b and b < c"))).toBe("a < b and b < c");
  });

  it("brackets a word operation next to an operator, and anything but a value inside one", () => {
    expect(exprText(expr("i % 15 == 0"))).toBe("(remainder of i divided by 15) = 0");
    expect(exprText(expr("(i + 1) % 3"))).toBe("remainder of (i + 1) divided by 3");
    expect(exprText(expr("abs(i % 3)"))).toBe("absolute value of (remainder of i divided by 3)");
    expect(exprText(expr("min(a, abs(b))"))).toBe("smaller of a and (absolute value of b)");
    expect(exprText(expr("-x ** 2"))).toBe("−(x to the power of 2)");
    expect(exprText(not(bin("<", v("a"), v("b"))))).toBe("not (a < b)");
    expect(exprText(expr("not a and b"))).toBe("(not a) and b");
    expect(exprText(expr("f(abs(x), y)"))).toBe("f(absolute value of x, y)");
    expect(exprText(expr("str(n) + str(m)"))).toBe("(n as text) + (m as text)");
  });

  it("marks variables, and an input still to fill at any depth (U-51)", () => {
    const hole = empty();
    const parts = exprParts(bin("+", v("total"), hole));
    expect(parts).toEqual([
      { text: "total", variable: true },
      { text: " + " },
      { text: "choose a value", empty: true, hole: hole.id },
    ]);
    const p = program([assign("total", bin("+", v("total"), hole))]);
    expect(sentenceParts(p.main[0]!, p).map((part) => [part.text, part.slot])).toEqual([
      ["create ", undefined],
      ["total", "target"],
      [" and set it to ", undefined],
      ["total", "value"],
      [" + ", "value"],
      ["choose a value", "value"],
    ]);
  });

  it("writes a variable as its value when the writing gives one", () => {
    const values: Record<string, string> = { i: "3" };
    expect(exprText(expr("i % 15 == 0"), { value: (name) => values[name] })).toBe(
      "(remainder of 3 divided by 15) = 0",
    );
  });

  it("capitalises a drawn sentence only when it begins with a word of its template", () => {
    const p = program([print(v("i")), if_(bin("<", v("i"), v("n")), [])]);
    expect(joinParts(drawn(sentenceParts(p.main[0]!, p)))).toBe("Print i");
    expect(joinParts(drawn(questionParts(p.main[1]!)))).toBe("i < n?");
  });
});

describe("diamonds and generated nodes (U-33, N-09)", () => {
  it("a diamond is its condition followed by ?, or the placeholder without it", () => {
    expect(joinParts(questionParts(if_(expr("i % 15 == 0"), [])))).toBe(
      "(remainder of i divided by 15) = 0?",
    );
    expect(joinParts(questionParts(if_(empty(), [])))).toBe("choose a value");
    // The condition's runs name its slot; the `?` names none.
    expect(questionParts(if_(v("ok"), [])).map((part) => part.slot)).toEqual(["cond", undefined]);
  });

  it("a counted loop's generated nodes carry the loop's own slots", () => {
    const loop = for_("i", num(1), bin("+", v("n"), num(1)), []);
    expect(generatedText(loop, "init")).toBe("Set i to 1");
    expect(generatedText(loop, "check")).toBe("i < n + 1?");
    expect(generatedText(loop, "step")).toBe("Set i to i + 1");
  });

  it("an Input node's name is a variable", () => {
    expect(inputParts("n", 15)).toEqual([
      { text: "Input " },
      { text: "n", variable: true },
      { text: " = 15" },
    ]);
  });
});
