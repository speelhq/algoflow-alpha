import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { getNode, menuBlocks } from "./registry";
import { ast, evalExpr } from "./testing";

describe("empty", () => {
  it("emits `...` so a program with an unfilled slot still renders as Python", () => {
    expect(unparse(ast.empty())).toBe("...");
    expect(unparse(ast.bin("+", ast.num(1), ast.empty()))).toBe("1 + ...");
  });

  it("is hidden from the block menu", () => {
    expect(menuBlocks("basic").some((def) => def.key === "empty")).toBe(false);
    expect(getNode("empty").hidden).toBe(true);
  });

  it("cannot run: the interpreter refuses an empty slot it is given", () => {
    const slot = ast.empty();
    expect(() => evalExpr(slot)).toThrow(`empty slot ${slot.id} cannot run`);
  });
});
