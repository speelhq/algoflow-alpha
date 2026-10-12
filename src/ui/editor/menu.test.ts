// The block menu's groups, order, disabled entries, search, and This program, which lists only
// functions a call can name.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { blankTemplate } from "@/ui/chart/text";
import { menuGroups, searchMenu } from "./menu";

const { v, while_ } = ast;
const MAIN = { parent: "main", slot: "main", index: 0 } as const;

describe("block menu", () => {
  it("groups follow the category order, each starting with its first blocks", () => {
    const groups = menuGroups(program([]), MAIN);
    expect(groups.map((group) => group.title)).toEqual(["Basic", "Control", "Function"]);
    const ids = groups.map((group) => group.entries.map((entry) => entry.id));
    expect(ids[0]?.slice(0, 2)).toEqual(["assign", "print"]);
    expect(ids[1]?.slice(0, 3)).toEqual(["if", "for", "while"]);
  });

  it("only statement blocks that are not hidden are listed", () => {
    const ids = menuGroups(program([]), MAIN).flatMap((group) => group.entries.map((e) => e.id));
    expect(ids).not.toContain("expr");
    expect(ids).not.toContain("num");
    expect(ids).not.toContain("empty");
  });

  it("a block whose requires the place does not meet is disabled with the reason", () => {
    const loop = while_(v("c"), []);
    const p = program([loop]);
    const outside = menuGroups(p, MAIN).flatMap((group) => group.entries);
    expect(outside.find((e) => e.id === "break")?.disabled).toBe("only inside a loop");
    expect(outside.find((e) => e.id === "return")?.disabled).toBe("only inside a function");
    const inside = menuGroups(p, { parent: loop.id, slot: "body", index: 0 }).flatMap(
      (group) => group.entries,
    );
    expect(inside.find((e) => e.id === "break")?.disabled).toBeUndefined();
    expect(inside.find((e) => e.id === "continue")?.disabled).toBeUndefined();
  });

  it("the program's functions follow under This program as calls", () => {
    const p = program([], {
      functions: [{ id: "fn0000000001", name: "double", params: ["x"], body: [] }],
    });
    const groups = menuGroups(p, MAIN);
    const last = groups[groups.length - 1];
    expect(last?.title).toBe("This program");
    expect(last?.entries.map((entry) => entry.text)).toEqual(["double(…)"]);
    const stmt = last?.entries[0]?.create();
    expect(stmt).toMatchObject({ kind: "expr", expr: { kind: "call", fn: "double" } });
    expect(stmt?.kind === "expr" && stmt.expr.kind === "call" && stmt.expr.args).toHaveLength(1);
  });

  it("a function no call can name is not offered: a word of the language, a builtin's name", () => {
    const reserved = program([], {
      functions: [
        { id: "fn0000000001", name: "double", params: ["x"], body: [] },
        { id: "fn0000000002", name: "None", params: [], body: [] },
        { id: "fn0000000003", name: "abs", params: ["x"], body: [] },
      ],
    });
    const offered = menuGroups(reserved, MAIN)
      .at(-1)
      ?.entries.map((entry) => entry.id);
    expect(offered).toEqual(["call:double"]);
  });

  it("entries show the block's template with … for each slot", () => {
    expect(blankTemplate("for {var} from {start} up to {stop}")).toBe("for … from … up to …");
    const entries = menuGroups(program([]), MAIN).flatMap((group) => group.entries);
    expect(entries.find((e) => e.id === "assign")?.text).toBe("set … to …");
    expect(entries.find((e) => e.id === "print")?.text).toBe("print …");
  });

  it("the search keeps the entries whose label or help contains the text", () => {
    const groups = menuGroups(program([]), MAIN);
    const found = searchMenu(groups, "LOOP");
    expect(found.flatMap((group) => group.entries.map((e) => e.id))).toEqual(
      expect.arrayContaining(["for", "while", "break"]),
    );
    expect(found.flatMap((group) => group.entries.map((e) => e.id))).not.toContain("print");
    expect(searchMenu(groups, "  ")).toBe(groups);
    expect(searchMenu(groups, "zzz")).toEqual([]);
    // The template text is not searched: `#` is in no label or help.
    expect(searchMenu(groups, "#")).toEqual([]);
  });

  it("each created block is a fresh statement", () => {
    const entry = menuGroups(program([]), MAIN)[0]?.entries[0];
    const a = entry?.create();
    const b = entry?.create();
    expect(a?.id).not.toBe(b?.id);
  });
});
