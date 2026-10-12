// Submit judges every test on its own runner in batches,
// without touching the driver; the driver judges the chosen case of a Run itself.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { judge, type TestResult } from "@/challenges/judge";
import { seedOf, type Test } from "@/challenges/types";
import type { Program } from "@/lang/types";
import { canRun } from "@/lang/validate";
import { outcomeOf, type Outcome } from "@/runtime/outcome";
import { run } from "@/runtime/run";
import type { Done } from "@/runtime/types";
import { inBatches } from "./batches";
import { useProgress } from "./progress";
import { useProgram } from "./program";

export type TestsState = {
  /** One verdict per challenge test, set once every test is judged. */
  results: TestResult[];
  /** What each test printed and left in its variables, for the rows of its case. */
  outcomes: Outcome[];
  running: boolean;
  /** Every test passed. */
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
  const runner = run(program, test.inputs, seedOf(test));
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

export const useTests = create<TestsState>()((set, get) => ({
  results: [],
  outcomes: [],
  running: false,
  cleared: false,
  selected: 0,

  async submit() {
    const target = current();
    if (!target) return;
    const mine = ++generation;
    set({ results: [], outcomes: [], running: true, cleared: false, selected: 0 });
    try {
      const results: TestResult[] = [];
      const outcomes: Outcome[] = [];
      for (const test of target.tests) {
        const outcome = await evaluate(target.program, test, mine);
        if (!outcome) return;
        results.push(judge(test, outcome));
        outcomes.push(outcome);
      }
      // `pnpm check` holds every challenge to three tests or more, so no submission is empty.
      const cleared = results.every((result) => result.status === "pass");
      const failing = results.findIndex((result) => result.status !== "pass");
      set({ results, outcomes, cleared, selected: Math.max(failing, 0) });
      useProgress.getState().submitted(target.id, cleared);
    } finally {
      // Also after an internal error, which leaves no verdict; a later action has set its own state.
      if (mine === generation) set({ running: false });
    }
  },

  select(index) {
    if (index >= 0 && index < get().results.length) set({ selected: index });
  },

  reset() {
    generation += 1;
    set({ results: [], outcomes: [], running: false, cleared: false, selected: 0 });
  },
}));

useProgram.subscribe((state, previous) => {
  if (state.program !== previous.program) useTests.getState().reset();
});
