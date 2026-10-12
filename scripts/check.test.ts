// The schema checker; the plans checker; a test checked against its expectation and against
// CPython, and the CPython script shape (no python run here).
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import type { Challenge } from "@/challenges/types";
import type { Stmt } from "@/lang/types";
import { checkTest, type PythonRunner } from "./lib/agreement";
import { checkChallengeSchema } from "./lib/challenge";
import { buildScript, randomShims } from "./lib/cpython";
import { execute } from "./lib/interp";
import { checkPlans } from "./lib/plans";

const { assign, num, bin, v, print, ret } = ast;

function valid() {
  const solution = program([assign("total", bin("+", v("n"), num(1)))], {
    inputs: [{ name: "n", kind: "number" }],
  });
  return {
    id: "demo",
    title: { en: "Demo" },
    difficulty: "easy",
    topics: ["variables"],
    description: { en: "Add one." },
    takeaway: { en: "You added one." },
    inputs: [{ name: "n", kind: "number" }],
    tests: [
      { inputs: { n: 1 }, edge: false, expect: { variables: { total: 2 } } },
      { inputs: { n: 0 }, edge: true, expect: { variables: { total: 1 } } },
      { inputs: { n: 10 }, edge: false, expect: { variables: { total: 11 } } },
    ],
    hints: [{ en: "a" }, { en: "b" }, { en: "c" }],
    solution: { ...solution, challengeId: "demo" },
  };
}

describe("checkChallengeSchema", () => {
  it("accepts a complete challenge", () => {
    expect(checkChallengeSchema(valid(), "demo").problems).toEqual([]);
  });

  it("reports each structural problem", () => {
    const c = valid();
    c.id = "other";
    c.hints = c.hints.slice(0, 2);
    c.tests[1]!.edge = false;
    delete (c.tests[2]!.inputs as Record<string, unknown>).n;
    c.solution.inputs = [{ name: "n", kind: "text" }];
    const { problems } = checkChallengeSchema(c, "demo");
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not match the file name"),
        expect.stringContaining("no test has edge: true"),
        expect.stringContaining("hints must be exactly 3"),
        expect.stringContaining('tests[2].inputs is missing "n"'),
        expect.stringContaining("solution.inputs must equal inputs"),
      ]),
    );
  });

  it("rejects a key the schema does not have, such as the removed starter", () => {
    const c = valid() as unknown as Record<string, unknown>;
    c.starter = c.solution;
    expect(checkChallengeSchema(c, "demo").problems).toEqual(['unknown key "starter"']);
  });

  it("checks difficulty, topics, and takeaway", () => {
    const c = valid() as unknown as Record<string, unknown>;
    c.difficulty = "trivial";
    c.topics = [];
    c.takeaway = "plain text";
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      expect.stringContaining('difficulty "trivial"'),
      expect.stringContaining("topics must be a non-empty array"),
      expect.stringContaining("takeaway must be { en, ja? }"),
    ]);
    c.difficulty = "hard";
    c.topics = ["loops", "knitting"];
    delete c.takeaway;
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      expect.stringContaining('topic "knitting"'),
    ]);
  });

  it("module is a name, and defines lists functions the solution itself defines", () => {
    const c = valid() as unknown as Record<string, unknown>;
    c.module = "Heap";
    c.defines = ["twice", 3];
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      "module must be a valid name",
      "defines must be an array of function names",
    ]);
    c.module = "heap";
    c.defines = ["twice", "Pair"];
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      "defines must be an array of function names",
    ]);
    c.defines = ["twice"];
    expect(checkChallengeSchema(c, "demo").problems).toEqual(['solution does not define "twice"']);
    const twice = { id: "f0000000000f", name: "twice", params: ["x"], body: [ret(v("x"))] };
    c.solution = { ...valid().solution, functions: [twice] };
    expect(checkChallengeSchema(c, "demo").problems).toEqual([]);
  });

  it("requires at least three tests and a non-empty expect", () => {
    const c = valid() as unknown as { tests: unknown[] };
    const [first, second] = valid().tests;
    c.tests = [first, { ...second, expect: {} }];
    const { problems } = checkChallengeSchema(c, "demo");
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("at least 3"),
        expect.stringContaining("tests[1].expect"),
      ]),
    );
  });

  it("inputs are declared with a kind, and every test's value has it, as canonical Data the blocks write", () => {
    const c = valid();
    (c.tests[0]!.inputs as Record<string, unknown>).n = "one";
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      "tests[0].inputs.n is not of the kind number",
    ]);
    const beyond = valid();
    (beyond.tests[1]!.inputs as Record<string, unknown>).n = 2 ** 53;
    (beyond.tests[2]!.expect.variables as Record<string, unknown>).total = [1, 2 ** 60];
    expect(checkChallengeSchema(beyond, "demo").problems).toEqual([
      "tests[1].inputs.n: expected an integer within the int range",
      "tests[2].expect.variables.total[1]: expected an integer within the int range",
    ]);
    // No list block exists yet, so no block writes a list.
    const list = valid();
    list.inputs = [{ name: "n", kind: "list" }];
    list.solution.inputs = [{ name: "n", kind: "list" }];
    for (const test of list.tests) (test.inputs as Record<string, unknown>).n = [1];
    expect(checkChallengeSchema(list, "demo").problems).toEqual(
      expect.arrayContaining(["tests[0].inputs.n is a value no block writes"]),
    );
    const undeclared = valid();
    (undeclared.inputs[0] as Record<string, unknown>).kind = "word";
    expect(checkChallengeSchema(undeclared, "demo").problems).toEqual(
      expect.arrayContaining(["inputs[0] must be { name, kind }"]),
    );
  });

  it("an object in a test is refused at its path, while no block constructs one", () => {
    const c = valid();
    (c.tests[0]!.expect.variables as Record<string, unknown>).total = { $cls: "Pair", a: 1 };
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      'tests[0].expect.variables.total["$cls"]: expected no object: no block constructs one',
    ]);
  });

  it("runs validate() on the solution and reports diagnostics", () => {
    const c = valid();
    c.solution = {
      ...program([print(v("ghost"))], { inputs: [{ name: "n", kind: "number" }] }),
      challengeId: "demo",
    };
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      expect.stringMatching(/^solution: E_UNDEFINED/),
    ]);
  });

  it("requires ja texts only when asked", () => {
    expect(checkChallengeSchema(valid(), "demo", { requireJa: true }).problems).toEqual(
      expect.arrayContaining([expect.stringContaining("title must be { en, ja? }")]),
    );
  });
});

describe("checkPlans", () => {
  const known = new Set(["a", "b", "c"]);
  const plan = (id: string, problems: unknown[]) => ({
    id,
    title: { en: id },
    description: { en: "one line" },
    problems,
  });

  it("accepts plans whose members exist once, in one plan each", () => {
    const result = checkPlans([plan("p", ["a", "b"]), plan("q", ["c"])], known);
    expect(result.problems).toEqual([]);
    expect(result.plans?.map((p) => p.id)).toEqual(["p", "q"]);
  });

  it("reports an unknown id, a repeated id, an id in two plans, a duplicate plan, an empty plan", () => {
    const { plans, problems } = checkPlans(
      [plan("p", ["a", "zzz", "a"]), plan("q", ["a"]), plan("q", []), { id: 3, problems: "a" }],
      known,
    );
    expect(plans).toBeNull();
    expect(problems).toEqual([
      expect.stringContaining('unknown challenge "zzz"'),
      expect.stringContaining('"a" is listed twice'),
      expect.stringContaining('"a" is in plan "p" and plan "q"'),
      expect.stringContaining('plan "q" is listed twice'),
      expect.stringContaining('plan "q" has no problems'),
      expect.stringContaining("plans[3] needs a string id"),
      expect.stringContaining("plans[3]: title must be"),
      expect.stringContaining("plans[3]: description must be"),
      expect.stringContaining("plans[3]: problems must be an array"),
      '"b" is in no plan',
      '"c" is in no plan',
    ]);
    expect(checkPlans({}, known).problems).toEqual(["plans.json must be an array"]);
  });

  it("reports a challenge in no plan", () => {
    expect(checkPlans([plan("p", ["a", "b"])], known).problems).toEqual(['"c" is in no plan']);
  });

  it("two plans sharing an id still report a member they both list", () => {
    const { problems } = checkPlans([plan("p", ["a"]), plan("p", ["a", 7])], new Set(["a"]));
    expect(problems).toEqual([
      expect.stringContaining('plan "p" is listed twice'),
      expect.stringContaining('"a" is in plan "p" and plan "p"'),
      expect.stringContaining('plan "p": problems[1] must be a challenge id'),
    ]);
  });
});

describe("execute (a run as the judge sees it)", () => {
  it("reports final main variables as Data, stdout, and draws", () => {
    const outcome = execute(
      program([assign("x", bin("*", v("n"), num(2))), print(v("x"))], {
        inputs: [{ name: "n", kind: "number" }],
      }),
      { n: 4 },
      1,
    );
    expect(outcome).toMatchObject({
      done: { type: "done" },
      stdout: ["8"],
      vars: { n: 4, x: 8 },
      draws: [],
    });
  });
});

describe("checkTest", () => {
  const addOne = () => assign("total", bin("+", v("n"), num(1)));
  /** The demo challenge with `main` as its solution's. */
  const challenge = (main: Stmt[]): Challenge => {
    const json = valid();
    const inputs = [{ name: "n", kind: "number" as const }];
    json.solution = { ...program(main, { inputs }), challengeId: "demo" };
    const checked = checkChallengeSchema(json, "demo").challenge;
    if (!checked) throw new Error("the demo challenge does not check");
    return checked;
  };
  /** A CPython that answers `result` and records what it was given. */
  const fake = (result: ReturnType<PythonRunner>) => {
    const calls: Parameters<PythonRunner>[] = [];
    const python: PythonRunner = (...args) => {
      calls.push(args);
      return result;
    };
    return { python, calls };
  };

  it("passes when the interpreter meets expect and CPython agrees, given the code, draws, and names", () => {
    const demo = challenge([addOne()]);
    const { python, calls } = fake({ stdout: [], vars: { n: 1, total: 2 } });
    expect(checkTest(demo, demo.tests[0]!, 0, python)).toEqual([]);
    expect(calls).toEqual([["n = 1\ntotal = n + 1\n", [], ["n", "total"]]]);
  });

  it("reports each row that differs from expect", () => {
    const demo = challenge([addOne()]);
    const test = { ...demo.tests[0]!, expect: { variables: { total: 99 } } };
    const { python } = fake({ stdout: [], vars: { n: 1, total: 2 } });
    expect(checkTest(demo, test, 0, python)).toEqual([
      'test[0] {"n":1}: total: expected 99, got 2',
    ]);
  });

  it("reports an interpreter error alone, without running CPython", () => {
    const div = bin("/", num(1), num(0));
    const demo = challenge([assign("total", div)]);
    const { python, calls } = fake({ stdout: [], vars: {} });
    expect(checkTest(demo, demo.tests[0]!, 0, python)).toEqual([
      `test[0] {"n":1}: interpreter E_DIV_ZERO at ${div.id} {}`,
    ]);
    expect(calls).toEqual([]);
  });

  it("reports CPython failing, and each line and variable where it differs from the interpreter", () => {
    const demo = challenge([addOne()]);
    expect(checkTest(demo, demo.tests[0]!, 0, fake({ error: "boom" }).python)).toEqual([
      'test[0] {"n":1}: python3 failed: boom',
    ]);
    expect(
      checkTest(demo, demo.tests[0]!, 0, fake({ stdout: ["x"], vars: { n: 1 } }).python),
    ).toEqual([
      'test[0] {"n":1}: CPython line 1: expected nothing, got "x"',
      'test[0] {"n":1}: CPython variable total was never assigned',
    ]);
  });
});

describe("buildScript", () => {
  it("wraps the code with the random shim, stdout capture, and the JSON epilogue", () => {
    const script = buildScript("x = random.randint(1, 6)\nprint(x)\n", [4], ["x"]);
    expect(script).toContain("_draws = iter([4])");
    expect(script).toContain('for _name in ["randint"]:');
    expect(script).toContain("builtins.print = _print");
    expect(script).toContain(
      'exec(compile("x = random.randint(1, 6)\\nprint(x)\\n", "solution.py", "exec"), _ns)',
    );
    expect(script).toContain('for name in ["x"] if name in _ns');
    expect(script).toContain('json.dumps({"stdout": _lines, "vars": _vars})');
  });

  it("derives the random shims from the registry", () => {
    expect(randomShims()).toEqual(["randint"]);
  });
});
