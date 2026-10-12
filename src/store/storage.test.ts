// @vitest-environment jsdom
// Reading and writing storage never throws out of a store.
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRecord } from "@/lang/record";
import { useLayout } from "./layout";
import { useProgress } from "./progress";
import { readStored, storedKeys, writeStored } from "./storage";

describe("storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("a full storage does not raise out of a store's set", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => useProgress.getState().hintShown("tutorial", 1)).not.toThrow();
    expect(() => useLayout.getState().setCollapsed(true)).not.toThrow();
    expect(writeStored("algoflow:x", 1)).toBe(false);
  });

  it("a value that is not JSON, or that parse rejects, reads as absent", () => {
    localStorage.setItem("algoflow:x", "{not json");
    expect(readStored("algoflow:x", (value) => value)).toBeUndefined();
    localStorage.setItem("algoflow:x", "[1]");
    expect(readStored("algoflow:x", (value) => (isRecord(value) ? value : undefined))).toBe(
      undefined,
    );
    expect(readStored("algoflow:none", (value) => value)).toBeUndefined();
  });

  it("lists the keys in storage", () => {
    localStorage.setItem("algoflow:a", "1");
    expect(storedKeys()).toContain("algoflow:a");
  });

  it("isRecord accepts an object and rejects an array and null", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});
