// Keywords, strings, numbers, and comments are coloured, and nothing else.
import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
  it("marks keywords, numbers, and leaves names and operators as text", () => {
    expect(highlight("for i in range(1, n + 1):")).toEqual([
      { kind: "keyword", text: "for" },
      { kind: "text", text: " i " },
      { kind: "keyword", text: "in" },
      { kind: "text", text: " range(" },
      { kind: "number", text: "1" },
      { kind: "text", text: ", n + " },
      { kind: "number", text: "1" },
      { kind: "text", text: "):" },
    ]);
  });

  it("marks a string with escapes, and keywords inside it stay part of the string", () => {
    expect(highlight('print("if \\"x\\"", True)')).toEqual([
      { kind: "text", text: "print(" },
      { kind: "string", text: '"if \\"x\\""' },
      { kind: "text", text: ", " },
      { kind: "keyword", text: "True" },
      { kind: "text", text: ")" },
    ]);
  });

  it("marks a comment to the end of the line, but not a # inside a string", () => {
    expect(highlight('x = "#"  # note')).toEqual([
      { kind: "text", text: "x = " },
      { kind: "string", text: '"#"' },
      { kind: "text", text: "  " },
      { kind: "comment", text: "# note" },
    ]);
  });

  it("reads floats and exponents as one number, and digits inside a name as text", () => {
    expect(highlight("x2 = 1.5e-06 + .5")).toEqual([
      { kind: "text", text: "x2 = " },
      { kind: "number", text: "1.5e-06" },
      { kind: "text", text: " + " },
      { kind: "number", text: ".5" },
    ]);
  });

  it("keeps indentation and an empty line", () => {
    expect(highlight("    pass")).toEqual([
      { kind: "text", text: "    " },
      { kind: "keyword", text: "pass" },
    ]);
    expect(highlight("")).toEqual([]);
  });
});
