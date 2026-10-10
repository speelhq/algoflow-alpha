// R-24 batches rely on `advance`; C-10 on `outcomeOf`.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { advance, outcomeOf } from "./outcome";
import { run } from "./run";

const { assign, num, print, v, for_ } = ast;

describe("advance and outcomeOf", () => {
  it("advance stops after `limit` events and reports undefined", () => {
    const runner = run(program([for_("i", num(0), num(5), [print(v("i"))])]), {}, 1);
    // enter for, loop, enter print, print (the line is recorded before the event is yielded)
    expect(advance(runner, 4)).toBeUndefined();
    expect(runner.stdout()).toEqual(["0"]);
  });

  it("advance returns the Done when the run finishes within the batch", () => {
    const runner = run(program([assign("x", num(2))]), {}, 1);
    const done = advance(runner, 100);
    expect(done).toEqual({ type: "done", steps: 2, loops: 0 });
  });

  it("R-22: next() after the end returns the same Done, after done and after an error", () => {
    const finished = run(program([assign("x", num(2))]), {}, 1);
    const done = advance(finished, 100);
    expect(finished.next()).toBe(done);
    expect(finished.next()).toBe(done);

    const failed = run(program([print(v("missing"))]), {}, 1);
    const error = advance(failed, 100);
    expect(error?.type).toBe("error");
    expect(failed.next()).toBe(error);
  });

  it("outcomeOf reports main variables as Data, stdout, and draws", () => {
    const runner = run(program([assign("x", num(2)), print(v("x"))]), {}, 1);
    const done = advance(runner, 100);
    if (!done) throw new Error("unfinished");
    expect(outcomeOf(runner, done)).toEqual({ done, stdout: ["2"], vars: { x: 2 }, draws: [] });
  });
});
