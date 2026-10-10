// The driver. Run first executes the whole program on a throwaway runner
// (the pre-run), so the length of the run, how it ends, and the step of every print are known
// before playback. The shown Runner, the play timer, and the cancel token live in module
// scope; the store holds what the UI renders. A backward Seek replays a fresh runner
// that reaches the same position, so a step number fully identifies a position.
import { create } from "zustand";
import { getChallenge } from "@/challenges";
import { judge, type TestResult } from "@/challenges/judge";
import { firstDifference, resultRows, watchStep, type WatchStep } from "@/challenges/rows";
import type { Test } from "@/challenges/types";
import type { Data, HeapEntry, Id, NodeId, Program } from "@/lang/types";
import { validate } from "@/lang/validate";
import { bodyStmts, nodesById, ownerStmts } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes/registry";
import { outcomeOf, type Outcome } from "@/runtime/outcome";
import { run as startRunner } from "@/runtime/run";
import type { Done, Event, Runner, State } from "@/runtime/types";
import { clamp, useLayout } from "./layout";
import { useProgram } from "./program";

export type Status = "idle" | "paused" | "playing" | "done" | "error";

export const BATCH = 2000;

export type RunState = {
  status: Status;
  /** A pre-run, a Seek, or a Skip is working through its batches. */
  busy: boolean;
  step: number;
  /** The visible steps of the whole run; after an error the failing step is step `total`. */
  total: number;
  /** How the pre-run ended. */
  outcome: Done | null;
  /** The visible step of each `print`; `prints[i]` produced line `i` of the output. */
  prints: number[];
  lastEvent: Event | null;
  /** Which pass a `loop` event starts, counted since its loop was entered; else null. */
  pass: number | null;
  /** The statement to highlight (owner of `lastEvent`, or of the error). */
  activeId: NodeId | null;
  state: State | null;
  /** The index of the frame shown; it follows the running frame. */
  frame: number;
  stdout: string[];
  /** The last check result per diamond, by statement id (✓ / ✗). */
  verdicts: Record<NodeId, boolean>;
  /** The statements entered in the current pass (the taken path). */
  taken: Record<NodeId, true>;
  breakpoint: NodeId | null;
  /** The chosen case, an index into the challenge's tests. */
  caseIndex: number;
  /** The chosen case's verdict, once the shown run is at its end. */
  verdict: TestResult | null;
  /** Where a run started by `Watch this case` opened, for the narration at that step. */
  difference: Difference | null;
  /** Pre-runs, then plays; with `watch`, opens paused at the first difference. */
  run: (opts?: { watch?: boolean }) => Promise<void>;
  stepOnce: () => void;
  play: () => void;
  pause: () => void;
  seek: (step: number) => Promise<void>;
  back: () => Promise<void>;
  skip: () => Promise<void>;
  stop: () => void;
  setBreakpoint: (id: NodeId | null) => void;
  selectCase: (index: number) => void;
};

export type Difference = WatchStep;

/** A run starts only when validation is clean. */
export function canRun(program: Program): boolean {
  return validate(program).length === 0;
}

// ---------------------------------------------------------------- module state

type Origin = { program: Program; inputs: Record<Id, Data>; seed: number; test: Test | undefined };
/** What the pre-run found, with the chosen case's verdict. */
type Plan = {
  total: number;
  outcome: Done;
  prints: number[];
  verdict: TestResult | null;
  difference: Difference;
};
type Projection = {
  step: number;
  lastEvent: Event | null;
  verdicts: Record<NodeId, boolean>;
  taken: Record<NodeId, true>;
  /** `loop` events per loop since its last `enter`. */
  passes: Map<NodeId, number>;
  /** Fields whose published copy is stale. */
  dirty: { stdout: boolean; verdicts: boolean; taken: boolean };
};

let runner: Runner | null = null;
let origin: Origin | null = null;
let plan: Plan | null = null;
let owners = new Map<NodeId, NodeId>();
let bodies = new Map<NodeId, NodeId[]>();
/** Each loop with the statements inside it; leaving the loop clears its own mark. */
let loops = new Map<NodeId, Set<NodeId>>();
let projection: Projection = freshProjection();
let breakpoint: NodeId | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
/** Bumped by every action; an async action that finds it changed after an `await` gives up. */
let generation = 0;
/** The step a Seek in flight is heading for, so that Back stacks while it is held. */
let target: number | null = null;
/** The run was started by `Watch this case`. */
let watching = false;
/** A pre-run, Seek, or Skip is working through its batches; Step and Play wait for it. */
let working = false;
/** Pause arrived during the pre-run: the run opens paused. */
let openPaused = false;
let tick: () => void = () => {};
const NO_PRINTS: number[] = [];

function freshProjection(): Projection {
  return {
    step: 0,
    lastEvent: null,
    verdicts: {},
    taken: {},
    passes: new Map(),
    dirty: { stdout: true, verdicts: true, taken: true },
  };
}

function clearTimer(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

function armTimer(): void {
  clearTimer();
  timer = setInterval(() => tick(), 1000 / useLayout.getState().speed);
}

function cancel(): void {
  generation += 1;
  target = null;
  working = false;
  clearTimer();
}

/** A published state is a copy; values are immutable records, so one level suffices. */
function copyEntry(entry: HeapEntry): HeapEntry {
  switch (entry.kind) {
    case "list":
      return { kind: "list", items: [...entry.items] };
    case "dict":
      return { kind: "dict", entries: new Map(entry.entries) };
    case "obj":
      return { kind: "obj", cls: entry.cls, fields: new Map(entry.fields) };
  }
}

function snapshot(): State | null {
  if (!runner) return null;
  const { frames, heap } = runner.state();
  return {
    frames: frames.map((frame) => ({ ...frame, vars: new Map(frame.vars) })),
    heap: new Map([...heap].map(([id, entry]) => [id, copyEntry(entry)])),
  };
}

/** Feeds one event into the projection (no store update). */
function apply(event: Event): void {
  const p = projection;
  p.step += 1;
  p.lastEvent = event;
  if (event.type === "enter") {
    if (event.nodeId in p.verdicts) {
      delete p.verdicts[event.nodeId];
      p.dirty.verdicts = true;
    }
    p.taken[event.nodeId] = true;
    p.dirty.taken = true;
    p.passes.delete(event.nodeId);
    for (const [loop, inside] of loops) {
      if (loop in p.verdicts && loop !== event.nodeId && !inside.has(event.nodeId)) {
        delete p.verdicts[loop];
        p.dirty.verdicts = true;
      }
    }
  } else if (event.type === "compare") {
    const owner = owners.get(event.nodeId);
    if (owner !== undefined) {
      p.verdicts[owner] = event.result;
      p.dirty.verdicts = true;
    }
  } else if (event.type === "loop") {
    // A new pass clears every mark in the loop's body; the loop's own check passed.
    for (const id of bodies.get(event.nodeId) ?? []) {
      delete p.verdicts[id];
      delete p.taken[id];
    }
    p.verdicts[event.nodeId] = true;
    p.dirty.verdicts = true;
    p.dirty.taken = true;
    p.passes.set(event.nodeId, (p.passes.get(event.nodeId) ?? 0) + 1);
  } else if (event.type === "print") p.dirty.stdout = true;
}

/** The loops among the statements with bodies, found by the registry's `loop` flag. */
function loopBodies(program: Program, all: Map<NodeId, NodeId[]>): Map<NodeId, Set<NodeId>> {
  const nodes = nodesById(program);
  const found = new Map<NodeId, Set<NodeId>>();
  for (const [id, inside] of all) {
    const node = nodes.get(id);
    if (node && getNode(keyOf(node)).loop) found.set(id, new Set(inside));
  }
  return found;
}

function atEnd(): boolean {
  return plan !== null && projection.step >= plan.total;
}

/**
 * One visible step; call only before the end. Every event is visible until module
 * frames exist: this is where the driver will pass over the steps inside one.
 */
function advance(): void {
  if (!runner || !plan) return;
  const next = runner.next();
  if (next.type === "done" || next.type === "error") {
    // The failing `next()` is itself step `total`; it has no event.
    projection.step = plan.total;
    projection.lastEvent = null;
    return;
  }
  apply(next);
  // The last event of a finished run: one more `next()` lets the frames unwind.
  if (projection.step === plan.total) runner.next();
}

/** The step just taken arrived at the breakpoint (its `enter`, or a pass of that loop). */
function atBreakpoint(): boolean {
  const event = projection.lastEvent;
  return (
    breakpoint !== null &&
    event !== null &&
    (event.type === "enter" || event.type === "loop") &&
    event.nodeId === breakpoint
  );
}

/** The print of the first differing line, or the last step of the run. */
function differenceOf(
  test: Test | undefined,
  outcome: Outcome,
  prints: number[],
  total: number,
): Difference {
  const first =
    outcome.done.type === "done" ? firstDifference(resultRows(test?.expect, outcome)) : null;
  return watchStep(first, prints, total);
}

function sleep(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The values the Input nodes show: the chosen test's. */
export function shownInputs(
  tests: readonly Test[] | undefined,
  caseIndex: number,
): Record<Id, Data> | undefined {
  return tests?.[caseIndex]?.inputs;
}

function originFor(caseIndex: number): Origin | null {
  const program = useProgram.getState().program;
  if (!canRun(program)) return null;
  const test = getChallenge(program.challengeId)?.tests[caseIndex];
  return { program, inputs: test?.inputs ?? {}, seed: test?.seed ?? 1, test };
}

function reset(from: Origin): void {
  runner = startRunner(from.program, from.inputs, from.seed);
  projection = freshProjection();
}

/** The whole run on a throwaway runner, in batches; undefined when another action took over. */
async function prerun(from: Origin, mine: number): Promise<Plan | undefined> {
  const probe = startRunner(from.program, from.inputs, from.seed);
  const prints: number[] = [];
  let events = 0;
  for (;;) {
    for (let i = 0; i < BATCH; i += 1) {
      const next = probe.next();
      if (next.type === "done" || next.type === "error") {
        const total = next.type === "error" ? events + 1 : events;
        const outcome = outcomeOf(probe, next);
        return {
          total,
          outcome: next,
          prints,
          verdict: from.test ? judge(from.test, outcome) : null,
          difference: differenceOf(from.test, outcome, prints, total),
        };
      }
      events += 1;
      if (next.type === "print") prints.push(events);
    }
    await sleep();
    if (mine !== generation) return undefined;
  }
}

export const useRun = create<RunState>()((set, get) => {
  /** Publishes the projection; a position at the end of the run decides the status itself. */
  const publish = (status: Status, busy = false) => {
    const p = projection;
    const previous = get();
    const ended = runner !== null && atEnd();
    if (ended) clearTimer();
    const outcome = plan?.outcome ?? null;
    const focus = ended && outcome?.type === "error" ? outcome.error.nodeId : p.lastEvent?.nodeId;
    const state = snapshot();
    set({
      status: ended && outcome ? outcome.type : status,
      busy,
      step: p.step,
      total: plan?.total ?? 0,
      outcome,
      prints: plan?.prints ?? NO_PRINTS,
      lastEvent: p.lastEvent,
      pass: p.lastEvent?.type === "loop" ? (p.passes.get(p.lastEvent.nodeId) ?? null) : null,
      activeId: focus === undefined ? null : (owners.get(focus) ?? focus),
      state,
      frame: state ? state.frames.length - 1 : 0,
      stdout: p.dirty.stdout ? (runner?.stdout() ?? []) : previous.stdout,
      verdicts: p.dirty.verdicts ? { ...p.verdicts } : previous.verdicts,
      taken: p.dirty.taken ? { ...p.taken } : previous.taken,
      breakpoint,
      verdict: ended ? (plan?.verdict ?? null) : null,
      difference: watching ? (plan?.difference ?? null) : null,
    });
    p.dirty = { stdout: false, verdicts: false, taken: false };
  };

  const running = () => runner !== null && !atEnd();

  /**
   * Steps up to `until` in batches, publishing `status` once per batch; with `breaks`
   * it also stops on arriving at the breakpoint. False when another action took over.
   */
  const batched = async (until: number, breaks: boolean, status: Status): Promise<boolean> => {
    const mine = generation;
    const finished = () => {
      working = false;
      return true;
    };
    working = true;
    for (;;) {
      for (let i = 0; i < BATCH; i += 1) {
        if (projection.step >= until) return finished();
        advance();
        if (breaks && !atEnd() && atBreakpoint()) return finished();
      }
      publish(status, true);
      await sleep();
      if (mine !== generation) return false;
    }
  };

  tick = () => {
    if (!running()) {
      clearTimer();
      return;
    }
    advance();
    if (!atEnd() && atBreakpoint()) {
      clearTimer();
      publish("paused");
    } else publish("playing");
  };

  return {
    status: "idle",
    busy: false,
    step: 0,
    total: 0,
    outcome: null,
    prints: [],
    lastEvent: null,
    pass: null,
    activeId: null,
    state: null,
    frame: 0,
    stdout: [],
    verdicts: {},
    taken: {},
    breakpoint: null,
    caseIndex: 0,
    verdict: null,
    difference: null,

    async run(opts) {
      const from = originFor(get().caseIndex);
      if (!from) return;
      get().stop();
      const mine = generation;
      working = true;
      openPaused = false;
      set({ busy: true });
      const made = await prerun(from, mine);
      if (!made) return;
      working = false;
      origin = from;
      plan = made;
      owners = ownerStmts(from.program);
      bodies = bodyStmts(from.program);
      loops = loopBodies(from.program, bodies);
      reset(from);
      watching = opts?.watch === true;
      if (watching) {
        if (await batched(made.difference.step, false, "paused")) publish("paused");
        return;
      }
      if (openPaused) {
        publish("paused");
        return;
      }
      if (!atEnd()) armTimer();
      publish("playing");
    },

    stepOnce() {
      if (!running() || working) return;
      cancel();
      advance();
      publish("paused");
    },

    play() {
      if (!running() || working || timer !== null) return;
      cancel();
      armTimer();
      publish("playing");
    },

    pause() {
      // During the pre-run there is nothing to pause yet: the run then opens paused.
      if (runner === null && working) openPaused = true;
      if (!running()) return;
      cancel();
      publish("paused");
    },

    async seek(step) {
      if (!runner || !plan || !origin) return;
      const to = clamp(Math.round(step), 0, plan.total);
      cancel();
      target = to;
      // Forward: the current runner goes on; backward: a fresh runner from step 0.
      if (to < projection.step) reset(origin);
      if (!(await batched(to, false, "paused"))) return;
      target = null;
      publish("paused");
    },

    back() {
      return get().seek((target ?? projection.step) - 1);
    },

    async skip() {
      if (!running() || !plan) return;
      cancel();
      publish("playing", true);
      if (await batched(plan.total, true, "playing")) publish("paused");
    },

    stop() {
      cancel();
      runner = null;
      origin = null;
      plan = null;
      watching = false;
      breakpoint = null;
      projection = freshProjection();
      publish("idle");
    },

    setBreakpoint(id) {
      if (!running()) return;
      breakpoint = id === null ? null : (owners.get(id) ?? id);
      set({ breakpoint });
    },

    selectCase(index) {
      get().stop();
      set({ caseIndex: index });
    },
  };
});

// A new speed takes effect on the running play timer.
useLayout.subscribe((current, previous) => {
  if (current.speed !== previous.speed && timer !== null) armTimer();
});

// A new program discards the runner; another problem also resets the chosen case.
useProgram.subscribe((current, previous) => {
  if (current.program === previous.program) return;
  useRun.getState().stop();
  if (current.program.challengeId !== previous.program.challengeId) {
    useRun.setState({ caseIndex: 0 });
  }
});
