// R-21: the driver. R-23 pre-run, R-25 Step, R-26 Play, R-27 Seek, R-28 Back, R-29 Stop; R-12
// state; R-19 breakpoint and Skip; U-108, U-109 marks; C-15 verdict; R-10: Seek replays identically.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChallenge, type Challenge } from "@/challenges";
import { ast, program, runAll, tid } from "@/nodes/testing";
import { SPEEDS, useLayout } from "./layout";
import { useProgram } from "./program";
import { BATCH, canRun, useRun, type RunState } from "./run";

const { assign, num, bin, v, print, for_, if_, while_, str, exprStmt, call, ret } = ast;

/** A problem whose one case gives a list: only a case puts a list into a run's state. */
const lists = vi.hoisted((): Challenge => ({
  id: "lists",
  title: { en: "Lists" },
  difficulty: "easy",
  topics: ["lists"],
  description: { en: "" },
  inputs: [{ name: "nums", kind: "list" }],
  tests: [{ inputs: { nums: [4, 5] }, expect: { variables: {} } }],
  hints: [],
  solution: { version: 1, title: "", inputs: [], classes: [], functions: [], main: [] },
}));

vi.mock("@/challenges", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/challenges")>();
  return {
    ...real,
    getChallenge: (id: string | undefined) => (id === lists.id ? lists : real.getChallenge(id)),
  };
});

const counting = () => program([for_("i", num(0), num(3), [print(v("i"))])]);
const long = () => program([for_("i", num(0), num(1500), [print(v("i"))])]);

const run = () => useRun.getState();

/**
 * Fires the `setTimeout(0)` between batches until the action resolves. Fake timers give a
 * timeout created while they tick a delay of 1 ms, so each batch costs 1 ms of fake time.
 */
async function settle(action: Promise<void>): Promise<void> {
  let settled = false;
  void action.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  // oxlint-disable-next-line no-unmodified-loop-condition -- the action's promise sets `settled`
  while (!settled) await vi.advanceTimersByTimeAsync(1);
}

/** Run, then Pause at step 0: where most cases start. */
async function paused(): Promise<void> {
  await settle(run().run());
  run().pause();
}

function position(s: RunState) {
  return {
    status: s.status,
    step: s.step,
    lastEvent: s.lastEvent,
    pass: s.pass,
    activeId: s.activeId,
    stdout: s.stdout,
    verdicts: s.verdicts,
    taken: s.taken,
    frame: s.frame,
    vars: s.state?.frames.map((frame) => [...frame.vars]),
  };
}

function fizzbuzz() {
  const challenge = getChallenge("fizzbuzz");
  if (!challenge) throw new Error("fizzbuzz missing");
  return challenge;
}

describe("run store (R-21)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useProgram.setState({ program: counting() });
    run().stop();
    useRun.setState({ caseIndex: 0 });
    useLayout.setState({ speed: SPEEDS.normal });
  });
  afterEach(() => {
    run().stop();
    vi.useRealTimers();
  });

  // ------------------------------------------------------------ R-12 state

  it("R-12: starts idle with every field empty", () => {
    expect(run()).toMatchObject({
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
    });
  });

  it("no runner before Run: Step, Play, Seek, Skip, and a breakpoint do nothing while idle", async () => {
    run().stepOnce();
    run().play();
    run().setBreakpoint("x");
    await run().seek(3);
    await run().skip();
    expect(run()).toMatchObject({ status: "idle", step: 0, breakpoint: null });
  });

  // ------------------------------------------------------------ R-23 pre-run

  it("R-23 pre-run: total, outcome, and the step of each print; then step 0, playing", async () => {
    await settle(run().run());
    expect(run()).toMatchObject({
      status: "playing",
      busy: false,
      step: 0,
      total: 10,
      outcome: { type: "done", steps: 10, loops: 3 },
      prints: [4, 7, 10],
      lastEvent: null,
      stdout: [],
    });
    expect(run().state?.frames).toHaveLength(1);
  });

  it("R-23, R-24, R-30 pre-run: batches of 2000 with setTimeout(0) between them; idle and busy meanwhile", async () => {
    useProgram.setState({ program: long() });
    const action = run().run();
    expect(run()).toMatchObject({ status: "idle", busy: true, total: 0 });
    await vi.advanceTimersByTimeAsync(0);
    expect(run()).toMatchObject({ status: "idle", busy: true, total: 0 });
    expect(vi.getTimerCount()).toBe(1);
    await settle(action);
    expect(run()).toMatchObject({ status: "playing", busy: false, step: 0, total: 4501 });
    expect(run().prints).toHaveLength(1500);
    expect(run().prints[1499]).toBe(4501);
  });

  it("R-23, R-32 error run: the failing step is step total, with no event and the error's statement", async () => {
    const div = bin("/", num(1), num(0));
    const stmt = assign("x", div);
    useProgram.setState({ program: program([stmt]) });
    await paused();
    expect(run()).toMatchObject({
      total: 2,
      outcome: {
        type: "error",
        error: { nodeId: div.id, code: "E_DIV_ZERO", params: {} },
        steps: 1,
      },
    });
    run().stepOnce();
    expect(run()).toMatchObject({ status: "paused", step: 1, lastEvent: { type: "enter" } });
    run().stepOnce();
    expect(run()).toMatchObject({ status: "error", step: 2, lastEvent: null, activeId: stmt.id });
    const stepped = position(run());
    await run().seek(1);
    expect(run().status).toBe("paused");
    await run().seek(2);
    expect(position(run())).toEqual(stepped);
  });

  it("R-32: an empty main is done at 0 of 0 and arms no timer", async () => {
    useProgram.setState({ program: program([]) });
    await settle(run().run());
    expect(run()).toMatchObject({ status: "done", step: 0, total: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("U-60: a pre-run that never ends reports E_STEP_LIMIT with the failing step as total", async () => {
    vi.useRealTimers();
    useProgram.setState({ program: program([while_(ast.bool(true), [])]) });
    await run().run();
    const { total, outcome } = run();
    run().stop();
    expect(total).toBe(1_000_001);
    expect(outcome).toMatchObject({ type: "error", error: { code: "E_STEP_LIMIT" } });
  }, 60_000);

  it("R-01: a program with diagnostics never starts", async () => {
    useProgram.setState({ program: program([print(v("ghost"))]) });
    expect(canRun(useProgram.getState().program)).toBe(false);
    await run().run();
    expect(run()).toMatchObject({ status: "idle", busy: false });
  });

  // ------------------------------------------------------------ R-25 Step, R-26 Play

  it("R-25 Step: one visible step per call, state refreshed each time", async () => {
    await paused();
    run().stepOnce();
    expect(run()).toMatchObject({ status: "paused", step: 1, lastEvent: { type: "enter" } });
    run().stepOnce();
    expect(run()).toMatchObject({ step: 2, lastEvent: { type: "loop", var: "i" }, pass: 1 });
    expect(run().activeId).toBe(useProgram.getState().program.main[0]?.id);
    expect(run().state?.frames[0]?.vars.get("i")).toEqual({ t: "int", v: 0 });
  });

  it("R-26 Play: one Step every 1000/speed ms at the layout's speed; a new speed re-arms the timer", async () => {
    await settle(run().run());
    vi.advanceTimersByTime(245);
    expect(run().step).toBe(0);
    vi.advanceTimersByTime(10);
    expect(run().step).toBe(1);
    useLayout.setState({ speed: SPEEDS.fast });
    vi.advanceTimersByTime(70);
    expect(run().step).toBe(2);
    run().pause();
    expect(run().status).toBe("paused");
    vi.advanceTimersByTime(1000);
    expect(run().step).toBe(2);
    run().play();
    vi.advanceTimersByTime(70);
    expect(run()).toMatchObject({ status: "playing", step: 3 });
  });

  it("R-32: the run is done on reaching step total; a finished run ignores Step and Play", async () => {
    await settle(run().run());
    vi.advanceTimersByTime(250 * 10);
    expect(run()).toMatchObject({ status: "done", step: 10, stdout: ["0", "1", "2"] });
    expect(vi.getTimerCount()).toBe(0);
    run().stepOnce();
    run().play();
    expect(run()).toMatchObject({ status: "done", step: 10 });
  });

  it("the frames have unwound when a call ends the run", async () => {
    const fn = { id: tid(), name: "one", params: [], body: [ret(num(1))] };
    useProgram.setState({ program: program([exprStmt(call("one"))], { functions: [fn] }) });
    await paused();
    await run().seek(3);
    expect(run()).toMatchObject({ status: "paused", frame: 1 });
    run().stepOnce();
    expect(run()).toMatchObject({
      status: "done",
      step: 4,
      frame: 0,
      lastEvent: { type: "return" },
    });
  });

  // ------------------------------------------------------------ R-27 Seek, R-28 Back, R-29 Stop

  it("Seek rebuilds the position from every event it passes, forward or from a fresh runner (R-27, R-10)", async () => {
    const hit = if_(bin("==", v("i"), num(1)), [print(v("i"))]);
    useProgram.setState({ program: program([for_("i", num(0), num(3), [hit])]) });
    const reference = runAll(useProgram.getState().program).events;
    await paused();
    await run().seek(7);
    const forward = position(run());
    expect(forward.lastEvent).toEqual(reference[6]);
    await run().seek(12);
    expect(run().status).toBe("done");
    await run().seek(7);
    expect(position(run())).toEqual(forward);
    await run().seek(0);
    expect(position(run())).toMatchObject({ step: 0, lastEvent: null, stdout: [], taken: {} });
    for (let k = 1; k <= 7; k += 1) run().stepOnce();
    expect(position(run())).toEqual(forward);
  });

  it("R-27, R-28: Seek clamps to [0, total]; Back is Seek(step - 1) and leaves a finished run paused", async () => {
    await paused();
    await run().seek(99);
    expect(run()).toMatchObject({ status: "done", step: 10 });
    await run().back();
    expect(run()).toMatchObject({ status: "paused", step: 9, stdout: ["0", "1"] });
    await run().seek(-4);
    expect(run()).toMatchObject({ status: "paused", step: 0 });
    await run().back();
    expect(run().step).toBe(0);
  });

  it("R-27, R-28, R-30: Seek works in batches and is busy meanwhile; Back held during it stacks on its target", async () => {
    useProgram.setState({ program: long() });
    await paused();
    const seeking = run().seek(4400);
    expect(run()).toMatchObject({ status: "paused", busy: true, step: BATCH });
    const first = run().back();
    const second = run().back();
    await settle(Promise.all([seeking, first, second]).then(() => {}));
    expect(run()).toMatchObject({ status: "paused", busy: false, step: 4398 });
  });

  it("R-29: Stop discards the runner, the pre-run's findings, and the timer", async () => {
    await settle(run().run());
    vi.advanceTimersByTime(1000);
    run().stop();
    expect(run()).toMatchObject({
      status: "idle",
      step: 0,
      total: 0,
      outcome: null,
      prints: [],
      lastEvent: null,
      state: null,
      stdout: [],
      verdicts: {},
      taken: {},
    });
    vi.advanceTimersByTime(1000);
    expect(run().step).toBe(0);
  });

  it("R-29: Stop during a pre-run publishes nothing later; a second Run in flight wins", async () => {
    useProgram.setState({ program: long() });
    const stopped = run().run();
    run().stop();
    await settle(stopped);
    expect(run()).toMatchObject({ status: "idle", busy: false, total: 0 });
    const first = run().run();
    const second = run().run();
    await settle(Promise.all([first, second]).then(() => {}));
    expect(run()).toMatchObject({ status: "playing", busy: false, total: 4501 });
    vi.advanceTimersByTime(250);
    expect(run().step).toBe(1);
  });

  it("R-31, R-30: Pause during the pre-run opens the run paused; Step and Play wait for a Seek in flight", async () => {
    useProgram.setState({ program: long() });
    const starting = run().run();
    run().pause();
    run().stepOnce();
    await settle(starting);
    expect(run()).toMatchObject({ status: "paused", busy: false, step: 0, total: 4501 });
    expect(vi.getTimerCount()).toBe(0);

    const seeking = run().seek(4400);
    run().play();
    run().stepOnce();
    await settle(seeking);
    expect(run()).toMatchObject({ status: "paused", busy: false, step: 4400 });
    run().stepOnce();
    expect(run().step).toBe(4401);
  });

  it("C-13: a new program stops the run; the case resets only with another problem", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    run().selectCase(1);
    await settle(run().run());
    useProgram.setState({ program: { ...fizzbuzz().solution } });
    expect(run()).toMatchObject({ status: "idle", caseIndex: 1 });
    useProgram.setState({ program: program([print(str("x"))]) });
    expect(run()).toMatchObject({ status: "idle", caseIndex: 0 });
  });

  it("R-12: a published state is a copy; later steps do not change it", async () => {
    const write = ast.assignTo({ kind: "index", list: v("nums"), index: num(0) }, num(9));
    useProgram.setState({
      program: {
        ...program([assign("x", num(1)), assign("x", num(2)), write], { inputs: lists.inputs }),
        challengeId: lists.id,
      },
    });
    await paused();
    await run().seek(2); // enter, write x = 1
    const kept = run().state;
    const list = kept?.frames[0]?.vars.get("nums");
    const items = () => (list && "ref" in list ? kept?.heap.get(list.ref) : undefined);
    expect(kept?.frames[0]?.vars.get("x")).toEqual({ t: "int", v: 1 });
    expect(items()).toEqual({
      kind: "list",
      items: [
        { t: "int", v: 4 },
        { t: "int", v: 5 },
      ],
    });
    await run().seek(run().total);
    expect(run().state?.frames[0]?.vars.get("x")).toEqual({ t: "int", v: 2 });
    expect(run().state).not.toBe(kept);
    expect(kept?.frames[0]?.vars.get("x")).toEqual({ t: "int", v: 1 });
    expect(items()).toEqual({
      kind: "list",
      items: [
        { t: "int", v: 4 },
        { t: "int", v: 5 },
      ],
    });
  });

  // ------------------------------------------------------------ R-19 breakpoint, Skip

  it("R-19: Play and Skip pause at each enter of the breakpoint; Play from it moves on", async () => {
    await paused();
    const loop = useProgram.getState().program.main[0];
    const printer = loop?.kind === "for" ? loop.body[0] : undefined;
    const arg = printer?.kind === "print" ? printer.args[0] : undefined;
    run().setBreakpoint(arg?.id ?? null);
    expect(run().breakpoint).toBe(printer?.id); // an expression's id means its statement
    run().play();
    vi.advanceTimersByTime(5000);
    expect(run()).toMatchObject({ status: "paused", step: 3 });
    expect(vi.getTimerCount()).toBe(0);
    run().play();
    vi.advanceTimersByTime(5000);
    expect(run()).toMatchObject({ status: "paused", step: 6 });
    await run().skip();
    expect(run()).toMatchObject({ status: "paused", step: 9 });
    await run().skip();
    expect(run()).toMatchObject({ status: "done", step: 10 });
  });

  it("R-19: a breakpoint on a loop pauses at its enter and at each of its loop events", async () => {
    await paused();
    run().setBreakpoint(useProgram.getState().program.main[0]?.id ?? null);
    const stops: number[] = [];
    while (run().status !== "done") {
      await run().skip();
      stops.push(run().step);
    }
    expect(stops).toEqual([1, 2, 5, 8, 10]);
  });

  it("R-19: Step and Seek ignore the breakpoint; Stop clears it", async () => {
    await paused();
    run().setBreakpoint(useProgram.getState().program.main[0]?.id ?? null);
    await run().seek(6);
    expect(run().step).toBe(6);
    await run().seek(0);
    run().stepOnce();
    run().stepOnce();
    run().stepOnce();
    expect(run()).toMatchObject({ status: "paused", step: 3 });
    run().stop();
    expect(run().breakpoint).toBeNull();
  });

  it("R-19 Skip: without a breakpoint it runs to the end and publishes no step between", async () => {
    await paused();
    const steps: number[] = [];
    const unsubscribe = useRun.subscribe((s) => steps.push(s.step));
    await run().skip();
    unsubscribe();
    expect(steps).toEqual([0, 10]);
    expect(run()).toMatchObject({ status: "done", busy: false });
  });

  it("R-19 Skip: in batches, status playing and busy; Pause and Seek cancel it", async () => {
    useProgram.setState({ program: long() });
    await paused();
    const skipping = run().skip();
    expect(run()).toMatchObject({ status: "playing", busy: true, step: BATCH });
    run().pause();
    await settle(skipping);
    expect(run()).toMatchObject({ status: "paused", busy: false, step: BATCH });
    const again = run().skip();
    const seeking = run().seek(10);
    await settle(Promise.all([again, seeking]).then(() => {}));
    expect(run()).toMatchObject({ status: "paused", busy: false, step: 10 });
  });

  it("R-19: a breakpoint on the last statement ends the run as done", async () => {
    const last = exprStmt(num(0));
    useProgram.setState({ program: program([print(str("a")), last]) });
    await paused();
    run().setBreakpoint(last.id);
    await run().skip();
    expect(run()).toMatchObject({ status: "done", step: 3 });
  });

  // ------------------------------------------------------------ U-108, U-109 marks

  it("U-108, U-109: a compare marks its statement; a new pass clears every mark in the loop's body", async () => {
    const inner = if_(bin("==", v("i"), num(0)), [print(v("i"))]);
    const outer = if_(bin("<", v("i"), num(1)), [inner]);
    const loop = for_("i", num(0), num(2), [outer]);
    useProgram.setState({ program: program([loop]) });
    await paused();
    // enter for, loop, enter outer, compare, enter inner, compare, enter print, print, loop, enter outer, compare
    await run().seek(8);
    expect(run().verdicts).toEqual({ [loop.id]: true, [outer.id]: true, [inner.id]: true });
    expect(Object.keys(run().taken)).toHaveLength(4);
    await run().seek(9);
    expect(run()).toMatchObject({
      pass: 2,
      verdicts: { [loop.id]: true },
      taken: { [loop.id]: true },
    });
    expect(Object.keys(run().verdicts)).toHaveLength(1);
    expect(Object.keys(run().taken)).toHaveLength(1);
    await run().seek(11);
    expect(run().verdicts).toEqual({ [loop.id]: true, [outer.id]: false });
    expect(run().taken).toEqual({ [loop.id]: true, [outer.id]: true });
  });

  it("U-108: a diamond is marked by its whole condition, not by a comparison inside it", async () => {
    const negated = if_(ast.not(bin("<", v("i"), num(1))), []);
    const found = if_(v("found"), []);
    useProgram.setState({
      program: program([assign("i", num(0)), negated, assign("found", num(1)), found]),
    });
    await paused();
    // enter, write, enter negated, compare(i < 1: true), compare(not: false), enter, write,
    // enter found, compare(found: true)
    await run().seek(4);
    expect(run().verdicts).toEqual({});
    await run().seek(5);
    expect(run().verdicts).toEqual({ [negated.id]: false });
    await run().seek(9);
    expect(run().verdicts).toEqual({ [negated.id]: false, [found.id]: true });
  });

  it("U-109: entering a diamond again clears its mark; a while shows its last check when it exits", async () => {
    const loop = while_(bin(">", v("n"), num(0)), [assign("n", bin("-", v("n"), num(1)))]);
    useProgram.setState({ program: program([assign("n", num(1)), loop]) });
    await paused();
    // enter assign, write, enter while, compare(true), loop, enter assign, write, compare(false)
    await run().seek(3);
    expect(run().verdicts).toEqual({});
    await run().seek(5);
    expect(run()).toMatchObject({ pass: 1, verdicts: { [loop.id]: true } });
    await run().seek(8);
    expect(run()).toMatchObject({ status: "done", verdicts: { [loop.id]: false } });
  });

  it("U-109: a for that ends loses its mark at the first statement after it", async () => {
    const loop = for_("i", num(0), num(2), [print(v("i"))]);
    const after = print(str("x"));
    useProgram.setState({ program: program([loop, after]) });
    await paused();
    // enter for, loop, enter print, print, loop, enter print, print, enter after, print
    await run().seek(7);
    expect(run().verdicts).toEqual({ [loop.id]: true });
    await run().seek(8);
    expect(run()).toMatchObject({ activeId: after.id, verdicts: {} });
  });

  it("U-109: a for left by break loses its mark too; a statement inside keeps it", async () => {
    const exit = if_(bin("==", v("i"), num(1)), [ast.brk()]);
    const loop = for_("i", num(0), num(5), [exit]);
    const after = print(str("x"));
    useProgram.setState({ program: program([loop, after]) });
    await paused();
    // enter for, loop, enter if, compare(false), loop, enter if, compare(true), enter break,
    // enter after, print
    await run().seek(8);
    expect(run().verdicts).toEqual({ [loop.id]: true, [exit.id]: true });
    await run().seek(9);
    expect(run().verdicts).toEqual({ [exit.id]: true });
  });

  // ------------------------------------------------------------ C-15 verdict

  it("C-15: the chosen case is judged at the end of the run, and only there", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    run().selectCase(1);
    await paused();
    expect(run().verdict).toBeNull();
    await run().skip();
    expect(run()).toMatchObject({ status: "done", stdout: ["1"], verdict: { status: "pass" } });
    await run().back();
    expect(run()).toMatchObject({ status: "paused", verdict: null });
  });

  it("C-15: a wrong output fails, a runtime error is the verdict, and no challenge means no verdict", async () => {
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("nope"))] } });
    await paused();
    await run().skip();
    expect(run().verdict).toMatchObject({
      status: "fail",
      mismatches: [{ kind: "stdout", actual: ["nope"] }],
    });

    const div = bin("/", num(1), num(0));
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [assign("x", div)] } });
    await paused();
    await run().skip();
    expect(run()).toMatchObject({
      status: "error",
      verdict: { status: "error", error: { nodeId: div.id, code: "E_DIV_ZERO" } },
    });

    useProgram.setState({ program: counting() });
    await paused();
    await run().skip();
    expect(run()).toMatchObject({ status: "done", verdict: null });
  });

  // ------------------------------------------------------------ U-32 cases

  it("U-32, C-15: a chosen case runs with its values and is judged at the end", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    run().selectCase(2);
    expect(run().caseIndex).toBe(2);
    await paused();
    await run().skip();
    expect(run().stdout).toEqual(["1", "2", "Fizz"]);
    expect(run().verdict).toMatchObject({ status: "pass" });
  });

  // ------------------------------------------------------------ U-81 Watch this case

  it("U-81: Watch this case opens paused at the print of the first differing line", async () => {
    const wrong = for_("i", num(0), bin("+", v("n"), num(1)), [print(v("i"))]); // from 0, not 1
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [wrong] } });
    run().selectCase(1);
    await settle(run().run({ watch: true }));
    // enter for, loop, enter print, print "0" against the expected "1"
    expect(run()).toMatchObject({
      status: "paused",
      busy: false,
      step: 4,
      stdout: ["0"],
      difference: { step: 4, line: 1 },
    });
    expect(vi.getTimerCount()).toBe(0);
    await run().seek(0);
    expect(run().difference).toEqual({ step: 4, line: 1 });
    run().stop();
    expect(run().difference).toBeNull();
  });

  it("U-81: when no print produced the difference, it opens at the last step of the run", async () => {
    const quiet = for_("i", num(1), v("n"), [print(v("i"))]); // one pass short: a line is missing
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [quiet] } });
    run().selectCase(2);
    await settle(run().run({ watch: true }));
    expect(run()).toMatchObject({ status: "done", step: 7, total: 7, stdout: ["1", "2"] });
    expect(run().difference).toEqual({ step: 7 });
    expect(run().verdict?.status).toBe("fail");

    await settle(run().run());
    expect(run()).toMatchObject({ status: "playing", difference: null });
  });
});
