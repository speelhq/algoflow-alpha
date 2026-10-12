// Work goes in batches of `BATCH` calls with setTimeout(0) between them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BATCH, inBatches } from "./batches";

describe("inBatches", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a batch is 20,000 calls", () => {
    expect(BATCH).toBe(20_000);
  });

  it("calls the step BATCH times per batch, with a timer and `between` after each unfinished one", async () => {
    let calls = 0;
    const between = vi.fn();
    const done = inBatches(
      () => (calls += 1) === BATCH * 2 + 5,
      between,
      () => false,
    );
    expect(calls).toBe(BATCH);
    expect(between).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(await done).toBe(true);
    expect(calls).toBe(BATCH * 2 + 5);
    expect(between).toHaveBeenCalledTimes(2);
  });

  it("gives up when the work is stale once it finished, also before any wait", async () => {
    let stale = false;
    const done = inBatches(
      () => true,
      () => {},
      () => stale,
    );
    stale = true;
    expect(await done).toBe(false);
  });

  it("gives up after a wait once the work is stale", async () => {
    let stale = false;
    const done = inBatches(
      () => false,
      () => {},
      () => stale,
    );
    stale = true;
    await vi.advanceTimersByTimeAsync(0);
    expect(await done).toBe(false);
  });
});
