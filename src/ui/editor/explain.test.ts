// U-96: the explanation line explains what the list highlights or the caret is in.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast, program } from "@/nodes/testing";
import { allEntries } from "./entries";
import { explainLine, explainVariable } from "./explain";
import { openLine, settle, type, type Line, type LineContext } from "./line";

const { assign, num, bin, v, for_, print, empty } = ast;

const ctx: LineContext = {
  variables: ["i", "total", "n"],
  kinds: new Map<string, Kind>([
    ["i", "number"],
    ["total", "number"],
    ["n", "number"],
  ]),
  scope: { classes: [], functions: [] },
  functions: [],
};

function keys(text: string, settled = true): Line {
  let line = openLine(empty());
  for (const key of text) line = type(line, key, ctx).line;
  return settled ? settle(line, ctx) : line;
}

const shown = (explained: ReturnType<typeof explainLine>) =>
  explained && [explained.name, explained.parts.map((part) => part.text).join("")];

const target = print(empty());
const p = program(
  [assign("total", num(0)), for_("i", num(1), bin("+", v("n"), num(1)), [target])],
  { inputs: [{ name: "n", kind: "number" }] },
);

describe("explanation line (U-96)", () => {
  it("an entry: its name and its help, ending with how to type it", () => {
    const remainder = allEntries().find((entry) => entry.id === "binop.mod");
    if (!remainder) throw new Error("no Remainder");
    const explained = explainLine(
      keys("i"),
      ctx,
      { kind: "entry", entry: remainder },
      p,
      target.id,
    );
    expect(explained?.name).toBe("Remainder");
    expect(explained?.parts.at(-2)).toEqual({ text: "%", slot: "key" });
  });

  it("a variable: its kind and the statement that first sets it; an input; a new name", () => {
    expect(explainVariable(p, target.id, "i")).toBe(
      "A number variable. It is first set in: Set i to 1.",
    );
    expect(explainVariable(p, target.id, "total")).toBe(
      "A number variable. It is first set in: Create total and set it to 0.",
    );
    expect(explainVariable(p, target.id, "n")).toBe("A number input of the problem.");
    expect(explainVariable(p, target.id, "found")).toBe("Creates the variable found here.");
  });

  it("inside an operation's input: its name and its template with that input underlined", () => {
    const explained = explainLine(keys("total+"), ctx, undefined, p, target.id);
    expect(shown(explained)).toEqual(["Add", "total + …"]);
    expect(explained?.parts.find((part) => part.underline)?.text).toBe("…");
  });

  it("a word that matches nothing: the closest name, or that nothing is like it", () => {
    expect(shown(explainLine(keys("totl", false), ctx, undefined, p, target.id))).toEqual([
      "totl",
      "Did you mean total?",
    ]);
    expect(shown(explainLine(keys("zzz", false), ctx, undefined, p, target.id))?.[1]).toBe(
      "Nothing has this name. Check the spelling, or choose from the list.",
    );
  });

  it("a refused key's message; else nothing, which leaves the block's help", () => {
    const refused = type(keys("i<n"), "<", ctx).line;
    expect(shown(explainLine(refused, ctx, undefined, p, target.id))?.[1]).toBe(
      "Write a < b < c as a < b and b < c",
    );
    expect(explainLine(openLine(v("n")), ctx, undefined, p, target.id)).toBeUndefined();
  });
});
