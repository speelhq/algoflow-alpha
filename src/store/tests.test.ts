// U-80, C-10, C-11, C-12: Submit judges every test on its own runner.
import { beforeEach, describe, expect, it } from "vitest";
import { getChallenge } from "@/challenges";
import { ast, program } from "@/nodes/testing";
import { useProgress } from "./progress";
import { useProgram } from "./program";
import { useRun } from "./run";
import { useTests } from "./tests";

const { assign, num, bin, print, str } = ast;

const fizzbuzz = () => {
  const challenge = getChallenge("fizzbuzz");
  if (!challenge) throw new Error("fizzbuzz missing");
  return challenge;
};

describe("tests store (U-80, C-10, C-11, C-12)", () => {
  beforeEach(() => {
    useRun.getState().stop();
    useTests.getState().reset();
  });

  it("Submit judges every test of the challenge and sets cleared when all pass", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    await useTests.getState().submit();
    const s = useTests.getState();
    expect(s.results).toEqual([{ status: "pass" }, { status: "pass" }, { status: "pass" }]);
    expect(s.cleared).toBe(true);
    expect(s.running).toBe(false);
  });

  it("a wrong program fails with expected and actual", async () => {
    useProgram.setState({
      program: {
        ...fizzbuzz().solution,
        main: [print(str("nope"))],
      },
    });
    await useTests.getState().submit();
    const s = useTests.getState();
    expect(s.cleared).toBe(false);
    expect(s.outcomes[1]).toMatchObject({ stdout: ["nope"], vars: { n: 1 } });
    expect(s.results[1]).toEqual({
      status: "fail",
      mismatches: [{ kind: "stdout", expected: ["1"], actual: ["nope"] }],
    });
  });

  it("U-81, U-86: selects the first failing test, and a chip selects another judged one", async () => {
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("1"))] } });
    await useTests.getState().submit();
    // n = 15 fails, n = 1 passes ("1"), n = 3 fails.
    expect(useTests.getState().results.map((r) => r?.status)).toEqual(["fail", "pass", "fail"]);
    expect(useTests.getState().selected).toBe(0);
    useTests.getState().select(2);
    expect(useTests.getState().selected).toBe(2);
    useTests.getState().select(7);
    expect(useTests.getState().selected).toBe(2);
    useTests.getState().reset();
    expect(useTests.getState().selected).toBe(0);
  });

  it("U-81: an accepted submission leaves the first chip selected", async () => {
    useProgram.setState({ program: fizzbuzz().solution });
    await useTests.getState().submit();
    expect(useTests.getState().selected).toBe(0);
  });

  it("U-80, C-17: a submission is recorded; an accepted one solves the problem for good", async () => {
    useProgress.setState({ entries: {} });
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("nope"))] } });
    await useTests.getState().submit();
    expect(useProgress.getState().entries.fizzbuzz?.status).toBe("attempted");
    useProgram.setState({ program: fizzbuzz().solution });
    await useTests.getState().submit();
    expect(useProgress.getState().entries.fizzbuzz?.status).toBe("solved");
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [print(str("nope"))] } });
    await useTests.getState().submit();
    expect(useProgress.getState().entries.fizzbuzz?.status).toBe("solved");
  });

  it("C-11: a runtime error is reported in the row", async () => {
    const div = bin("/", num(1), num(0));
    useProgram.setState({ program: { ...fizzbuzz().solution, main: [assign("x", div)] } });
    await useTests.getState().submit();
    expect(useTests.getState().results[0]).toEqual({
      status: "error",
      error: { nodeId: div.id, code: "E_DIV_ZERO", params: {} },
    });
  });

  it("free mode and invalid programs are ignored; a new program resets the results", async () => {
    useProgram.setState({ program: program([print(str("x"))]) });
    await useTests.getState().submit();
    expect(useTests.getState().results).toEqual([]);
    useProgram.setState({ program: fizzbuzz().solution });
    await useTests.getState().submit();
    expect(useTests.getState().cleared).toBe(true);
    useProgram.setState({ program: program([]) });
    expect(useTests.getState()).toMatchObject({ results: [], outcomes: [], cleared: false });
  });
});
