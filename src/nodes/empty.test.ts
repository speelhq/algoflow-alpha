import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { getNode, paletteNodes } from "./registry";
import { ast } from "./testing";

describe("empty (L-09)", () => {
  it("emits `...` so a program with an unfilled slot still renders as Python", () => {
    expect(unparse(ast.empty())).toBe("...");
    expect(unparse(ast.bin("+", ast.num(1), ast.empty()))).toBe("1 + ...");
  });

  it("is hidden from the palette and cannot run", () => {
    expect(paletteNodes("basic").some((def) => def.key === "empty")).toBe(false);
    expect(getNode("empty").hidden).toBe(true);
  });
});
