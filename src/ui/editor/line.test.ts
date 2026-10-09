// U-50, U-52, U-53, U-54, U-93: the value line as keys and choices change it.
import { describe, expect, it } from "vitest";
import type { Expr, Kind } from "@/lang/types";
import { ast } from "@/nodes/testing";
import { unparse } from "@/python/emit";
import { exprText } from "@/ui/chart/text";
import { allEntries } from "./entries";
import {
  backspace,
  choose,
  clickAt,
  endText,
  exactRow,
  matches,
  move,
  openLine,
  setText,
  settle,
  switchTo,
  tab,
  type,
  type Line,
  type LineContext,
  type Row,
} from "./line";
import { listSections } from "./list";

const ctx: LineContext = {
  variables: ["i", "total", "n", "ok", "nums"],
  kinds: new Map<string, Kind>([
    ["i", "number"],
    ["total", "number"],
    ["n", "number"],
    ["ok", "truefalse"],
    ["nums", "list"],
  ]),
  scope: { classes: [], functions: ["twice"] },
  functions: [{ name: "twice", params: ["x"] }],
};

const empty = () => openLine(ast.empty());

/** Types `keys` one by one; a refused key leaves the line as it was. */
function keys(text: string, line: Line = empty()): Line {
  let current = line;
  for (const key of text) current = type(current, key, ctx).line;
  return settle(current, ctx);
}

/** Types `keys` and leaves the last word as typed. */
function raw(text: string, line: Line = empty()): Line {
  let current = line;
  for (const key of text) current = type(current, key, ctx).line;
  return current;
}

const py = (line: Line) => unparse(line.root);
const entry = (id: string): Row => {
  const found = allEntries().find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return { kind: "entry", entry: found };
};
const groups = (line: Line, all = false) =>
  listSections(line, ctx, all).map((section) => [
    section.group,
    section.rows.map((row) =>
      row.kind === "entry"
        ? row.entry.label
        : row.kind === "variable"
          ? row.name
          : row.kind === "function"
            ? row.fn.name
            : "( )",
    ),
  ]);

describe("typing (U-50, U-93)", () => {
  it("keys insert what the chart writes", () => {
    expect(py(keys("i%15==0"))).toBe("i % 15 == 0");
    expect(exprText(keys("i%15==0").root)).toBe("(remainder of i divided by 15) = 0");
    expect(py(keys("a<=b".replace("a", "i").replace("b", "n")))).toBe("i <= n");
    expect(py(keys("i!=n"))).toBe("i != n");
    expect(py(keys("i>=n"))).toBe("i >= n");
    expect(py(keys("i//2"))).toBe("i // 2");
    expect(py(keys("i-1"))).toBe("i - 1");
    expect(py(keys("i*2/n"))).toBe("i * 2 / n");
  });

  it("a single = inserts nothing; = typed twice is Equals", () => {
    expect(py(keys("i="))).toBe("i");
    expect(keys("i=").pending?.key).toBe("=");
    expect(py(keys("i=0"))).toBe("i");
  });

  it("a - at an input still to fill is the sign of what follows", () => {
    expect(py(keys("-1"))).toBe("-1");
    expect(py(keys("n*-1"))).toBe("n * -1");
    expect(py(keys("-i"))).toBe("-i");
  });

  it("digits make a number; a number Python rejects or one after another value is not taken", () => {
    expect(py(keys("2.5"))).toBe("2.5");
    expect(py(keys("07"))).toBe("0");
    expect(py(keys("1..5"))).toBe("1.5");
    expect(py(keys("i 5"))).toBe("i");
    expect(keys("i 5").root).toMatchObject({ kind: "var", name: "i" });
  });

  it("an operator's key at an input still to fill inserts nothing", () => {
    expect(type(empty(), "*", ctx).taken).toBe(false);
    expect(type(keys("i+"), "*", ctx).taken).toBe(false);
  });

  it("operators bind by precedence; ** and // typed as two keys bind by their own", () => {
    expect(py(keys("total+i*2"))).toBe("total + i * 2");
    expect(py(keys("total*i+2"))).toBe("total * i + 2");
    expect(py(keys("i-n-1"))).toBe("i - n - 1");
    expect(py(keys("2*3**2"))).toBe("2 * 3 ** 2");
    expect(keys("2*3**2").root).toMatchObject({ op: "*", right: { op: "**" } });
    expect(py(keys("2**3**2"))).toBe("2 ** 3 ** 2");
    expect(py(keys("-3**2"))).toBe("-3 ** 2");
    expect(py(keys("i<n and ok"))).toBe("i < n and ok");
    expect(py(keys("not ok and ok"))).toBe("not ok and ok");
    expect(keys("not ok and ok").root).toMatchObject({ op: "and", left: { op: "not" } });
  });

  it("brackets group what is inside them and are not stored", () => {
    const line = keys("(i+1)*2");
    expect(py(line)).toBe("(i + 1) * 2");
    expect(line.open).toEqual([]);
    expect(keys("(i+1").open).toHaveLength(1);
    expect(py(keys("2*(i+1"))).toBe("2 * (i + 1)");
  });

  it("a click inside an open bracket keeps it open; a call's ( is its own and ) leaves it", () => {
    const opened = raw("i*(5");
    const clicked = clickAt(opened, (opened.root as Extract<Expr, { kind: "binop" }>).right.id);
    expect(clicked.open).toHaveLength(1);
    expect(py(keys("+1", clicked))).toBe("i * (5 + 1)");
    expect(py(keys("twice(i)+1"))).toBe("twice(i) + 1");
    // A word operation has no brackets for ) to close.
    const abs = keys("i", choose(empty(), entry("call:abs"), ctx).line);
    expect(type(abs, ")", ctx).taken).toBe(false);
  });

  it("Tab forgets the first key of a two-key operator", () => {
    const moved = tab(raw("i*"), 1, ctx).line;
    expect(moved.pending).toBeUndefined();
    expect(type(moved, "*", ctx).taken).toBe(false);
  });

  it("a comparison typed after a comparison is refused with E_PARSE_CHAIN's message", () => {
    const line = keys("i<n");
    const refused = type(line, "<", ctx);
    expect(refused.taken).toBe(false);
    expect(refused.line.refused).toBe("Write a < b < c as a < b and b < c");
    expect(py(keys("(i<n)==ok"))).toBe("(i < n) == ok");
  });

  it("a word ends at a space or a key: chosen when it names one exactly, else it stays", () => {
    expect(py(keys("total+1"))).toBe("total + 1");
    const typo = raw("totl+");
    expect(typo.word).toBe("totl");
    expect(py(typo)).toBe("...");
    expect(py(keys("i and ok"))).toBe("i and ok");
    expect(py(keys("i in nums"))).toBe("i in nums");
  });

  it("a word matches the start of a name's words or an entry's keys, the kind's first", () => {
    const after = raw("i==0 an");
    expect(matches(after, ctx).map((row) => (row.kind === "entry" ? row.entry.label : ""))[0]).toBe(
      "And",
    );
    const names = matches(raw("t"), ctx).map((row) =>
      row.kind === "variable" ? row.name : row.kind,
    );
    expect(names).toEqual(["total", "entry", "entry", "function"]);
    expect(exactRow(raw("i"), ctx)).toEqual({ kind: "variable", name: "i" });
    expect(matches(raw("i%"), ctx)).toEqual([]);
    expect(
      matches(raw("n mult"), ctx).map((row) => row.kind === "entry" && row.entry.label),
    ).toEqual(["Multiply"]);
  });
});

describe("choosing (U-53)", () => {
  it("an entry after a value takes it as its first input; inputs left are fields", () => {
    const line = keys("i");
    const abs = choose(line, entry("call:abs"), ctx).line;
    expect(py(abs)).toBe("abs(i)");
    const more = choose(keys("i"), entry("call:max"), ctx).line;
    expect(py(more)).toBe("max(i, ...)");
    expect("at" in more.caret).toBe(true);
    // A word operation takes what the list is about; an operator binds by precedence.
    expect(py(choose(keys("total+i"), entry("call:str"), ctx).line)).toBe("str(total + i)");
    expect(py(choose(keys("i<n"), entry("call:str"), ctx).line)).toBe("str(i < n)");
    expect(py(choose(keys("total+i"), entry("binop.mul"), ctx).line)).toBe("total + i * ...");
    // Brackets typed first limit it to a part.
    expect(py(choose(keys("total+(i"), entry("call:str"), ctx).line)).toBe("total + str(i)");
  });

  it("where a value is expected, an entry fills the input and the caret moves to its first input", () => {
    const placed = choose(empty(), entry("binop.add"), ctx).line;
    expect(py(placed)).toBe("... + ...");
    const random = choose(empty(), entry("call:random_int"), ctx).line;
    expect(py(random)).toBe("random.randint(..., ...)");
    expect(py(choose(empty(), { kind: "variable", name: "n" }, ctx).line)).toBe("n");
    expect(py(choose(empty(), { kind: "function", fn: ctx.functions[0]! }, ctx).line)).toBe(
      "twice(...)",
    );
    expect(py(choose(empty(), entry("bool.false"), ctx).line)).toBe("False");
  });

  it("Text places a text field typed without quotes", () => {
    const line = choose(empty(), entry("str"), ctx).line;
    expect(line.text).toBeDefined();
    const typed = endText(setText(line, line.text ?? "", "Fizz"));
    expect(py(typed)).toBe('"Fizz"');
    expect(typed.text).toBeUndefined();
  });

  it("a selected value is replaced by a value typed; an operator's key takes it", () => {
    const n = openLine(ast.v("n"));
    expect(n.selected).toBe(true);
    expect(py(keys("*", n))).toBe("n * ...");
    expect(py(keys("5", n))).toBe("5");
    expect(py(raw("i", n))).toBe("...");
    expect(py(keys("i ", n))).toBe("i");
    expect(py(keys("-1", n))).toBe("-1");
  });

  it("an operator clicked is switched to another entry of its block", () => {
    const line = keys("i<n");
    expect(
      py(
        switchTo(
          line,
          line.root.id,
          allEntries().find((e) => e.id === "binop.le")!,
        ),
      ),
    ).toBe("i <= n");
  });
});

describe("Backspace and moving (U-54, U-53)", () => {
  const back = (line: Line, times = 1) => {
    let current = line;
    for (let i = 0; i < times; i += 1) current = backspace(current).line;
    return current;
  };

  it("removes the last digit, a value, or the operator before the caret", () => {
    expect(py(back(keys("125")))).toBe("12");
    expect(py(back(keys("i+12"), 2))).toBe("i + ...");
    expect(py(back(keys("i+12"), 3))).toBe("i");
    expect(py(back(keys("i")))).toBe("...");
    expect(py(back(openLine(ast.v("n"))))).toBe("...");
  });

  it("after an operation that ends in an input, it removes what ends that input", () => {
    const inside = keys("12", choose(empty(), entry("call:abs"), ctx).line);
    const after = move(inside, 1).line;
    expect(py(back(after))).toBe("abs(1)");
    expect(py(back(after, 3))).toBe("...");
  });

  it("on an operation's words it removes the operation and keeps its first input", () => {
    const line = choose(keys("i"), entry("call:str"), ctx).line;
    expect(py(back(line))).toBe("i");
  });

  it("at a first input still to fill while a later one holds a value, it moves left", () => {
    const opened = choose(keys("i*("), entry("binop.add"), ctx).line;
    const filled = keys("3", tab(opened, 1, ctx).line);
    expect(py(filled)).toBe("i * (... + 3)");
    const sum = (filled.root as Extract<Expr, { kind: "binop" }>).right;
    const first = clickAt(filled, (sum as Extract<Expr, { kind: "binop" }>).left.id);
    const after = backspace(first).line;
    expect(py(after)).toBe("i * (... + 3)");
    expect(after.caret).toEqual({
      after: (filled.root as Extract<Expr, { kind: "binop" }>).left.id,
    });
  });

  it("at a later input still to fill, it moves left while another later input holds a value", () => {
    const three = { name: "three", params: ["a", "b", "c"] };
    const wide: LineContext = {
      ...ctx,
      scope: { classes: [], functions: ["twice", "three"] },
      functions: [...ctx.functions, three],
    };
    const placed = choose(empty(), { kind: "function", fn: three }, wide).line;
    const second = tab(keys("1", placed), 1, wide).line;
    const third = tab(keys("2", second), 1, wide).line;
    expect(py(third)).toBe("three(1, 2, ...)");
    const left = backspace(third).line;
    expect(py(left)).toBe("three(1, 2, ...)");
    expect("after" in left.caret).toBe(true);
    // With nothing after the first input, the call goes and its first input stays.
    const bare = tab(tab(keys("1", placed), 1, wide).line, 1, wide).line;
    expect(py(bare)).toBe("three(1, ..., ...)");
    expect(py(backspace(bare).line)).toBe("1");
  });

  it("Tab moves between inputs still to fill, then to the next slot", () => {
    const placed = choose(empty(), entry("call:random_int"), ctx).line;
    const second = tab(placed, 1, ctx);
    expect(second.move).toBeUndefined();
    expect(tab(second.line, 1, ctx).move).toBe("next");
    expect(tab(placed, -1, ctx).move).toBe("previous");
    expect(tab(openLine(ast.v("n")), 1, ctx).move).toBe("next");
  });

  it("→ at the end of an operation's last input leaves it", () => {
    const inside = keys("1", choose(empty(), entry("call:abs"), ctx).line);
    expect(py(keys("+2", inside))).toBe("abs(1 + 2)");
    expect(py(keys("+2", move(inside, 1).line))).toBe("abs(1) + 2");
  });
});

describe("the list (U-52)", () => {
  it("where a value is expected: variables, values, Not, Random whole number and ( ), functions", () => {
    expect(groups(empty())).toEqual([
      ["variables", ["i", "total", "n", "ok", "nums"]],
      ["values", ["Text", "True", "False", "None"]],
      ["conditions", ["Not"]],
      ["calculate", ["Random whole number", "( )"]],
      ["functions", ["twice"]],
    ]);
  });

  it("after a value, its kind's group and Compare and Convert", () => {
    expect(groups(keys("i")).map(([group]) => group)).toEqual(["calculate", "compare", "convert"]);
    expect(groups(keys("i==0"))).toEqual([
      ["conditions", ["And", "Or"]],
      ["compare", ["Equals", "Does not equal", "Is in a list"]],
      ["convert", ["As text"]],
    ]);
    expect(groups(keys("nums"))).toEqual([
      ["items", ["Join with another list"]],
      ["compare", ["Equals", "Does not equal", "Is in a list"]],
      ["convert", ["As text"]],
    ]);
  });

  it("after a value of no known kind every entry that takes one; Show all lists every entry", () => {
    const unknown = choose(empty(), { kind: "function", fn: ctx.functions[0]! }, ctx).line;
    const left = move(unknown, 1).line;
    expect(groups(left).map(([group]) => group)).toEqual([
      "conditions",
      "calculate",
      "items",
      "compare",
      "convert",
    ]);
    expect(groups(empty(), true).map(([group]) => group)).toEqual([
      "variables",
      "values",
      "conditions",
      "calculate",
      "items",
      "compare",
      "convert",
      "functions",
    ]);
  });
});
