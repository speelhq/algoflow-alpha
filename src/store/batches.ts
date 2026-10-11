// The one batch loop of the stores: work that may not end (a run of the learner's program) is
// done a batch of calls at a time, with `setTimeout(0)` between batches so the tab stays live.

/** Calls of a step per batch. */
export const BATCH = 20_000;

function sleep(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Calls `step` until it returns true, `BATCH` calls at a time; after each batch that did not
 * finish, calls `between` and waits for the next turn of the event loop. Resolves true when
 * `step` finished, false when `stale()` holds after a wait or once it finished (another action
 * took over, also one made right after the call, before the work could resume).
 */
export async function inBatches(
  step: () => boolean,
  between: () => void,
  stale: () => boolean,
): Promise<boolean> {
  for (;;) {
    for (let i = 0; i < BATCH; i += 1) {
      if (step()) {
        await Promise.resolve();
        return !stale();
      }
    }
    between();
    await sleep();
    if (stale()) return false;
  }
}
