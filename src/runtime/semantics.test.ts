// What the runtime itself decides: the int range and the sign of zero, the rules under Values and
// the run of language.md, the params a runtime error carries, and the event rules.
import { describe, expect, it } from "vitest";
import { ast, evalExpr, eventTypes, program, runAll, varData, withInputs } from "@/nodes/testing";
import { run, STEP_LIMIT } from "./run";
import { floatRepr, strRepr } from "./values";

const {
  num,
  float,
  str,
  bool,
  none,
  bin,
  v,
  neg,
  not,
  assign,
  assignTo,
  print,
  while_,
  for_,
  call,
  exprStmt,
  if_,
} = ast;

describe("values and the run", () => {
  it("an int result outside the int range becomes float", () => {
    expect(evalExpr(bin("+", num(9007199254740990), num(1))).value).toEqual({
      t: "int",
      v: 2 ** 53 - 1,
    });
    // 2^53 is also what 2^53 + 1 rounds to, so it is no int.
    expect(evalExpr(bin("+", num(9007199254740991), num(1))).value.t).toBe("float");
    expect(evalExpr(bin("+", num(9007199254740991), num(2))).value.t).toBe("float");
    expect(evalExpr(bin("**", num(2), num(53))).value.t).toBe("float");
    const lowest = bin("-", num(0), num(9007199254740991));
    expect(evalExpr(lowest).value).toEqual({ t: "int", v: -(2 ** 53 - 1) });
    expect(evalExpr(bin("-", lowest, num(1))).value.t).toBe("float");
  });

  it("negative zero: -(0.0) is -0.0, ints never carry a sign on zero", () => {
    const negFloat = evalExpr(neg(float(0))).value;
    expect(negFloat.t === "float" && Object.is(negFloat.v, -0)).toBe(true);
    const intZero = evalExpr(bin("*", num(0), neg(num(1)))).value;
    expect(intZero.t === "int" && Object.is(intZero.v, 0)).toBe(true);
    expect(
      runAll(program([print(neg(float(0))), print(call("float", bin("*", num(0), neg(num(1)))))]))
        .stdout,
    ).toEqual(["-0.0", "0.0"]);
  });

  it("a bool is no number for arithmetic and ordering", () => {
    for (const op of ["+", "<"] as const) {
      expect(evalExpr(bin(op, bool(true), num(1))).done).toMatchObject({
        type: "error",
        error: { code: "E_TYPE", params: { left: "bool", right: "int" } },
      });
    }
  });

  it('false values: 0, 0.0, "", [], {}, None, False', () => {
    const falsy = [num(0), float(0), str(""), none(), bool(false)];
    for (const value of falsy) expect(evalExpr(not(value)).data).toBe(true);
    expect(evalExpr(not(v("xs")), { xs: [] }).data).toBe(true);
    expect(evalExpr(not(v("d")), { d: {} }).data).toBe(true);
    expect(evalExpr(not(num(2))).data).toBe(false);
    expect(evalExpr(not(v("xs")), { xs: [0] }).data).toBe(false);
  });

  it("a list index is int, negative from the end, else E_INDEX (write path)", () => {
    const write = (index: number) => {
      const stmt = assignTo({ kind: "index", list: v("xs"), index: num(index) }, num(0));
      const made = withInputs({ xs: [1, 2] }, [stmt]);
      return runAll(made.program, made.inputs);
    };
    expect(varData(write(-1), "xs")).toEqual([1, 0]);
    expect(write(2).done).toMatchObject({
      type: "error",
      error: { code: "E_INDEX", params: { index: 2, length: 2 } },
    });
  });

  it("dict keys are int or str, else E_TYPE (write path)", () => {
    const write = (key: ReturnType<typeof num>) => {
      const made = withInputs({ d: {} }, [assignTo({ kind: "key", dict: v("d"), key }, num(0))]);
      return runAll(made.program, made.inputs);
    };
    expect(varData(write(str("k")), "d")).toEqual({ k: 0 });
    expect(varData(write(num(3)), "d")).toEqual({ "$int:3": 0 });
    expect(write(float(1.5)).done).toMatchObject({ type: "error", error: { code: "E_TYPE" } });
  });

  it("assignment copies the reference", () => {
    const made = withInputs({ xs: [1] }, [
      assign("ys", v("xs")),
      assignTo({ kind: "index", list: v("ys"), index: num(0) }, num(9)),
    ]);
    const result = runAll(made.program, made.inputs);
    expect(varData(result, "xs")).toEqual([9]);
  });

  it("a run stops with E_STEP_LIMIT after 1,000,000 events", () => {
    const runner = run(program([while_(bool(true), [])]), {}, 1);
    let last;
    for (let i = 0; i < STEP_LIMIT + 5; i += 1) {
      last = runner.next();
      if (last.type === "error" || last.type === "done") break;
    }
    expect(last).toMatchObject({
      type: "error",
      error: { code: "E_STEP_LIMIT" },
      steps: STEP_LIMIT,
    });
  });
});

describe("the params a runtime error carries", () => {
  it("E_VALUE and E_NUMBER_TEXT carry the registry key of the failing expression as op", () => {
    expect(evalExpr(neg(v("xs")), { xs: [] }).done).toMatchObject({
      type: "error",
      error: { code: "E_VALUE", params: { op: "unop", type: "list" } },
    });
    expect(evalExpr(call("int", str("seven"))).done).toMatchObject({
      type: "error",
      error: { code: "E_NUMBER_TEXT", params: { op: "call:int", text: "seven" } },
    });
  });

  it("E_TYPE carries the operand type names", () => {
    expect(evalExpr(bin("-", v("xs"), num(1)), { xs: [] }).done).toMatchObject({
      type: "error",
      error: { params: { left: "list", right: "int" } },
    });
  });
});

describe("event rules", () => {
  it("per statement: enter, expression events, then the effect", () => {
    const stmt = assign("ok", bin("and", bin("<", num(1), num(2)), bin("<", num(2), num(3))));
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "compare", "compare", "write"]);
  });

  it("a condition ends in one compare of its whole self", () => {
    const compared = bin("<", num(1), num(2));
    const plain = runAll(program([if_(compared, [])]));
    expect(plain.events.filter((e) => e.type === "compare")).toEqual([
      { type: "compare", nodeId: compared.id, result: true },
    ]);
    const negated = not(bin("<", num(1), num(2)));
    const inner = negated.kind === "unop" ? negated.operand.id : "";
    const result = runAll(program([if_(negated, [])]));
    expect(result.events.filter((e) => e.type === "compare")).toEqual([
      { type: "compare", nodeId: inner, result: true },
      { type: "compare", nodeId: negated.id, result: false },
    ]);
  });

  it("a condition whose call reaches the same diamond still ends in its own compare", () => {
    // def g(n): if n > 0 and g(n - 1): pass
    const cond = bin("and", bin(">", v("n"), num(0)), call("g", bin("-", v("n"), num(1))));
    const g = { id: "f0000000000f", name: "g", params: ["n"], body: [if_(cond, [])] };
    const result = runAll(program([exprStmt(call("g", num(1)))], { functions: [g] }));
    expect(result.events.filter((e) => e.type === "compare" && e.nodeId === cond.id)).toEqual([
      { type: "compare", nodeId: cond.id, result: false },
      { type: "compare", nodeId: cond.id, result: false },
    ]);
  });

  it("steps counts all events and loops counts loop events", () => {
    const result = runAll(
      program([for_("i", num(0), num(3), [exprStmt(bin("<", v("i"), num(1)))])]),
    );
    expect(result.done).toEqual({ type: "done", steps: 1 + 3 * 3, loops: 3 });
  });

  it("the same program, inputs, and seed produce the same event sequence", () => {
    const prog = program([
      for_("i", num(0), num(5), [assign("x", call("random_int", num(0), num(9)))]),
    ]);
    expect(runAll(prog, {}, 3).events).toEqual(runAll(prog, {}, 3).events);
  });

  it("state() exposes the main frame and heap; stdout() the printed lines", () => {
    const result = runAll(program([assign("x", num(1)), print(v("x"))]));
    expect(result.state.frames).toHaveLength(1);
    expect(result.state.frames[0]?.fn).toBe("main");
    expect(result.stdout).toEqual(["1"]);
  });
});

describe("text forms", () => {
  it("floatRepr follows Python repr", () => {
    expect(floatRepr(2)).toBe("2.0");
    expect(floatRepr(0.1)).toBe("0.1");
    expect(floatRepr(14.003)).toBe("14.003");
    expect(floatRepr(1e-6)).toBe("1e-06");
    expect(floatRepr(0.0001)).toBe("0.0001");
    expect(floatRepr(1e16)).toBe("1e+16");
    expect(floatRepr(1e15)).toBe("1000000000000000.0");
    expect(floatRepr(-0.5)).toBe("-0.5");
    expect(floatRepr(-0)).toBe("-0.0");
    expect(floatRepr(2 ** 60)).toBe("1.152921504606847e+18");
    expect(floatRepr(Number.POSITIVE_INFINITY)).toBe("inf");
  });

  it("strRepr follows Python repr quoting", () => {
    expect(strRepr("a")).toBe("'a'");
    expect(strRepr("it's")).toBe('"it\'s"');
    expect(strRepr("a\nb")).toBe("'a\\nb'");
  });
});
