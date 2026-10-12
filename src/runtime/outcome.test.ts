import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { finish, outcomeOf } from "./outcome";
import { run } from "./run";

const { assign, num, print, v } = ast;

describe("finish and outcomeOf", () => {
  it("finish returns the Done of the run", () => {
    const runner = run(program([assign("x", num(2))]), {}, 1);
    const done = finish(runner);
    expect(done).toEqual({ type: "done", steps: 2, loops: 0 });
  });

  it("next() after the end returns the same Done, after done and after an error", () => {
    const finished = run(program([assign("x", num(2))]), {}, 1);
    const done = finish(finished);
    expect(finished.next()).toBe(done);
    expect(finished.next()).toBe(done);

    const failed = run(program([print(v("missing"))]), {}, 1);
    const error = finish(failed);
    expect(error.type).toBe("error");
    expect(failed.next()).toBe(error);
  });

  it("outcomeOf reports main variables as Data, stdout, and draws", () => {
    const runner = run(program([assign("x", num(2)), print(v("x"))]), {}, 1);
    const done = finish(runner);
    expect(outcomeOf(runner, done)).toEqual({ done, stdout: ["2"], vars: { x: 2 }, draws: [] });
  });
});
