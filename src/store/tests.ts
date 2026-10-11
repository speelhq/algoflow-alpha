// Submit judges every test on its own runner in batches,
// without touching the driver; the driver judges the chosen case of a Run itself.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { judge, type TestResult } from "@/challenges/judge";
import type { Test } from "@/challenges/types";
import type { Program } from "@/lang/types";
import { canRun } from "@/lang/validate";
import { outcomeOf, type Outcome } from "@/runtime/outcome";
import { run } from "@/runtime/run";
import type { Done } from "@/runtime/types";
import { inBatches } from "./batches";
import { useProgress } from "./progress";
import { useProgram } from "./program";

export type TestsState = {
  /** One entry per challenge test; null until judged. */
  results: Array<TestResult | null>;
  /** What each judged test printed and left in its variables, for the rows of its case. */
  outcomes: Array<Outcome | null>;
  running: boolean;
  /** Every test judged and passing. */
  cleared: boolean;
  /** The chip whose rows are shown: the first failing test once judged, else 0. */
  selected: number;
  submit: () => Promise<void>;
  select: (index: number) => void;
  reset: () => void;
};

let generation = 0;

/** One test on its own runner, in batches; undefined once a later action took over. */
async function evaluate(program: Program, test: Test, mine: number): Promise<Outcome | undefined> {
  const runner = run(program, test.inputs, test.seed ?? 1);
  let done: Done | undefined;
  const step = (): boolean => {
    const next = runner.next();
    if (next.type !== "done" && next.type !== "error") return false;
    done = next;
    return true;
  };
  const finished = await inBatches(
    step,
    () => {},
    () => mine !== generation,
  );
  return finished && done ? outcomeOf(runner, done) : undefined;
}

function current(): { id: string; program: Program; tests: Test[] } | null {
  const program = useProgram.getState().program;
  const challenge = getChallenge(program.challengeId);
  return challenge && canRun(program)
    ? { id: challenge.id, program, tests: challenge.tests }
    : null;
}

export const useTests = create<TestsState>()((set, get) => {
  const record = (index: number, test: Test, outcome: Outcome, count: number) => {
    const results = [...get().results];
    const outcomes = [...get().outcomes];
    while (results.length < count) results.push(null);
    while (outcomes.length < count) outcomes.push(null);
    results[index] = judge(test, outcome);
    outcomes[index] = outcome;
    set({
      results,
      outcomes,
      cleared: results.length === count && results.every((r) => r?.status === "pass"),
    });
  };

  const guarded = async (mine: number, work: () => Promise<void>) => {
    set({ running: true });
    try {
      await work();
    } finally {
      if (mine === generation) set({ running: false });
    }
  };

  return {
    results: [],
    outcomes: [],
    running: false,
    cleared: false,
    selected: 0,

    submit() {
      const target = current();
      if (!target) return Promise.resolve();
      const mine = ++generation;
      return guarded(mine, async () => {
        let passed = 0;
        for (const [index, test] of target.tests.entries()) {
          const outcome = await evaluate(target.program, test, mine);
          if (!outcome) return;
          record(index, test, outcome, target.tests.length);
          if (get().results[index]?.status === "pass") passed += 1;
        }
        // Accepted only when every test of this submission passed.
        useProgress.getState().submitted(target.id, passed > 0 && passed === target.tests.length);
        const failing = get().results.findIndex((result) => result?.status !== "pass");
        set({ selected: Math.max(failing, 0) });
      });
    },

    select(index) {
      if (index >= 0 && index < get().results.length) set({ selected: index });
    },

    reset() {
      generation += 1;
      set({ results: [], outcomes: [], running: false, cleared: false, selected: 0 });
    },
  };
});

useProgram.subscribe((state, previous) => {
  if (state.program !== previous.program) useTests.getState().reset();
});
