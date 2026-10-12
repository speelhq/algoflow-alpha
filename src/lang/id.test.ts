import { describe, expect, it } from "vitest";
import { isNodeId, newId } from "./id";

describe("NodeId (language.md, Program)", () => {
  it("is 12 characters from the nanoid alphabet", () => {
    for (let i = 0; i < 100; i += 1) expect(isNodeId(newId())).toBe(true);
  });

  it("does not repeat in practice", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });

  it("rejects other shapes", () => {
    expect(isNodeId("short")).toBe(false);
    expect(isNodeId("has space 123")).toBe(false);
    expect(isNodeId(12)).toBe(false);
  });
});
