// Test helpers for the stores, which run in batches under Vitest's fake timers.
import { vi } from "vitest";

/**
 * Fires the `setTimeout(0)` between batches until the action resolves. Fake timers give a
 * timeout created while they tick a delay of 1 ms, so each batch costs 1 ms of fake time.
 */
export async function settle(action: Promise<unknown>): Promise<void> {
  let settled = false;
  void action.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  // oxlint-disable-next-line no-unmodified-loop-condition -- the action's promise sets `settled`
  while (!settled) await vi.advanceTimersByTimeAsync(1);
}
