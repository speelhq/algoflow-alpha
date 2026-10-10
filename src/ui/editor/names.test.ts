// U-94, U-102, U-104: the list under a name field, and what a name field keeps.
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/challenges";
import { ast, program } from "@/nodes/testing";
import { nameChars, nameSections } from "./names";

const { assign, num, for_ } = ast;

const shown = (sections: ReturnType<typeof nameSections>) =>
  sections.map((section) => [section.group, section.rows.map((row) => row.name)]);

describe("name list", () => {
  it("U-94: the problem's names first, in order, then the program's other variables, with no limit", () => {
    const p = program(
      [assign("count", num(0)), for_("k", num(0), num(3), []), assign("total", num(1))],
      { inputs: [{ name: "n", kind: "number" }] },
    );
    expect(shown(nameSections(p, ["total", "best"], ""))).toEqual([
      ["problem", ["total", "best"]],
      ["variables", ["n", "count", "k"]],
    ]);
    const many = program(["a", "b", "c", "d", "e", "f", "g"].map((name) => assign(name, num(0))));
    expect(nameSections(many, [], "")[0]?.rows).toHaveLength(7);
  });

  it("U-94, U-102: Sum to n: total under This problem; typing to offers New variable to", () => {
    const sum = CHALLENGES.find((challenge) => challenge.id === "sum-to-n");
    if (!sum) throw new Error("sum-to-n missing");
    const asked = Object.keys(sum.tests[0]?.expect.variables ?? {});
    const p = program([], { inputs: [{ name: "n", kind: "number" }] });
    expect(shown(nameSections(p, asked, ""))[0]).toEqual(["problem", ["total"]]);
    expect(shown(nameSections(p, asked, "to"))).toEqual([
      ["problem", ["total"]],
      ["new", ["to"]],
    ]);
  });

  it("U-102: typing keeps the names one of whose words begins with it; a valid new name is offered", () => {
    const p = program([assign("max_len", num(0)), assign("lens", num(0))]);
    expect(shown(nameSections(p, [], "le"))).toEqual([
      ["variables", ["max_len", "lens"]],
      ["new", ["le"]],
    ]);
    expect(shown(nameSections(p, [], "lens"))).toEqual([["variables", ["lens"]]]);
    // A whole name comes first.
    const both = program([assign("idx", num(0)), assign("i", num(0))]);
    expect(shown(nameSections(both, [], "i"))).toEqual([["variables", ["i", "idx"]]]);
    expect(shown(nameSections(p, [], "for"))).toEqual([]); // a keyword: no new name
    expect(shown(nameSections(p, [], "len"))).toEqual([["variables", ["max_len", "lens"]]]);
  });

  it("U-104: a name field keeps only the characters of L-01", () => {
    expect(nameChars("Total Sum-1_x")).toBe("otalum1_x");
    expect(nameChars("i")).toBe("i");
    expect(nameChars("1x2")).toBe("x2");
  });
});
