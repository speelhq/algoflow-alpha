// C-01, C-03: the schema checker; C-25, C-18: the plans checker; R-20: the CPython
// script shape (no python run here).
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { checkChallengeSchema } from "./lib/challenge";
import { buildScript, randomShims } from "./lib/cpython";
import { execute } from "./lib/interp";
import { checkPlans } from "./lib/plans";

const { assign, num, bin, v, print, ret } = ast;

function valid() {
  const solution = program([assign("total", bin("+", v("n"), num(1)))], {
    inputs: [{ name: "n", value: 1 }],
  });
  return {
    id: "demo",
    title: { en: "Demo" },
    difficulty: "easy",
    topics: ["variables"],
    description: { en: "Add one." },
    takeaway: { en: "You added one." },
    inputs: [{ name: "n", value: 1 }],
    tests: [
      { inputs: { n: 1 }, edge: false, expect: { variables: { total: 2 } } },
      { inputs: { n: 0 }, edge: true, expect: { variables: { total: 1 } } },
      { inputs: { n: 10 }, edge: false, expect: { variables: { total: 11 } } },
    ],
    hints: [{ en: "a" }, { en: "b" }, { en: "c" }],
    solution: { ...solution, challengeId: "demo" },
  };
}

describe("checkChallengeSchema (C-01, C-03)", () => {
  it("accepts a complete challenge", () => {
    expect(checkChallengeSchema(valid(), "demo").problems).toEqual([]);
  });

  it("reports each structural problem", () => {
    const c = valid();
    c.id = "other";
    c.hints = c.hints.slice(0, 2);
    c.tests[1]!.edge = false;
    delete (c.tests[2]!.inputs as Record<string, unknown>).n;
    c.solution.inputs = [{ name: "n", value: 2 }];
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

  it("C-01: rejects a key the schema does not have, such as the removed starter", () => {
    const c = valid() as unknown as Record<string, unknown>;
    c.starter = c.solution;
    expect(checkChallengeSchema(c, "demo").problems).toEqual(['unknown key "starter"']);
  });

  it("C-01: checks difficulty, topics (U-14), and takeaway", () => {
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

  it("C-01, C-21: module is a name, and defines lists names the solution itself defines", () => {
    const c = valid() as unknown as Record<string, unknown>;
    c.module = "Heap";
    c.defines = ["twice", 3];
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      "module must be a valid name",
      "defines must be an array of function or class names",
    ]);
    c.module = "heap";
    c.defines = ["twice", "Pair"];
    expect(checkChallengeSchema(c, "demo").problems).toEqual([
      'solution does not define "twice"',
      'solution does not define "Pair"',
    ]);
    const twice = { id: "f0000000000f", name: "twice", params: ["x"], body: [ret(v("x"))] };
    const pair = { id: "c0000000000c", name: "Pair", fields: [] };
    c.solution = { ...valid().solution, functions: [twice], classes: [pair] };
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

  it("runs validate() on the solution and reports diagnostics", () => {
    const c = valid();
    c.solution = {
      ...program([print(v("ghost"))], { inputs: [{ name: "n", value: 1 }] }),
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

describe("checkPlans (C-25, C-18)", () => {
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

describe("execute (C-10 view of a run)", () => {
  it("reports final main variables as Data, stdout, and draws", () => {
    const outcome = execute(
      program([assign("x", bin("*", v("n"), num(2))), print(v("x"))], {
        inputs: [{ name: "n", value: 4 }],
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

describe("buildScript (R-20)", () => {
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

  it("derives the random shims from the registry (N-05)", () => {
    expect(randomShims()).toEqual(["randint"]);
  });
});
