// R-21: the semantics examples of language.md, the R-09 codes reachable with
// the basic and control blocks, and the R-03/R-08/R-10 event rules.
import { describe, expect, it } from "vitest";
import { ast, evalExpr, eventTypes, program, runAll, varData } from "@/nodes/testing";
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
} = ast;

describe("the semantics table of language.md", () => {
  it("L-10 int ∘ int is int for + - * // % ** (non-negative exponent); / is float", () => {
    expect(evalExpr(bin("//", num(7), num(2))).value).toEqual({ t: "int", v: 3 });
    expect(evalExpr(bin("/", num(4), num(2))).value).toEqual({ t: "float", v: 2 });
    expect(evalExpr(bin("*", num(3), num(4))).value).toEqual({ t: "int", v: 12 });
    expect(evalExpr(bin("**", num(3), num(2))).value).toEqual({ t: "int", v: 9 });
  });

  it("L-07 an int result beyond ±2^53 becomes float", () => {
    expect(evalExpr(bin("**", num(2), num(53))).value).toEqual({ t: "int", v: 2 ** 53 });
    expect(evalExpr(bin("**", num(2), num(60))).value.t).toBe("float");
  });

  it("L-12 float // and % follow CPython, including the sign of zero", () => {
    expect(evalExpr(bin("%", num(1), float(0.1))).data).toBe(1 % 0.1); // 0.09999999999999995 in both engines
    expect(evalExpr(bin("//", num(1), float(0.1))).data).toEqual({ $float: 9 });
    expect(evalExpr(bin("%", float(-7.5), num(2))).data).toBe(0.5);
    expect(evalExpr(bin("//", float(-7.5), num(2))).data).toEqual({ $float: -4 });
    const negativeZero = evalExpr(bin("%", float(4), neg(num(2)))).value;
    expect(negativeZero.t === "float" && Object.is(negativeZero.v, -0)).toBe(true);
    expect(evalExpr(bin("%", float(0.1), float(0.01))).data).toBe(0.1 % 0.01);
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

  it("R-09 E_UNDEFINED at run time: a loop variable read after a loop that never ran", () => {
    const read = v("i");
    const result = runAll(
      program([for_("i", num(0), v("n"), []), print(read)], { inputs: [{ name: "n", value: 0 }] }),
      { n: 0 },
    );
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: read.id, code: "E_UNDEFINED", params: { name: "i" } },
    });
  });

  it("L-63 random_int(5, 1) → E_EMPTY_RANGE, as CPython's empty range", () => {
    expect(evalExpr(call("random_int", num(5), num(1))).done).toMatchObject({
      type: "error",
      error: { code: "E_EMPTY_RANGE", params: { a: 5, b: 1 } },
    });
  });

  it("L-11 any float operand → float", () => {
    expect(evalExpr(bin("+", num(1), float(2))).value).toEqual({ t: "float", v: 3 });
  });

  it("L-12 // floors; % takes the divisor's sign", () => {
    expect(evalExpr(bin("//", neg(num(7)), num(2))).data).toBe(-4);
    expect(evalExpr(bin("%", neg(num(7)), num(2))).data).toBe(1);
  });

  it("L-13 division or modulo by zero → E_DIV_ZERO", () => {
    expect(evalExpr(bin("/", num(1), num(0))).done).toMatchObject({
      type: "error",
      error: { code: "E_DIV_ZERO" },
    });
    expect(evalExpr(bin("%", float(1), num(0))).done).toMatchObject({
      type: "error",
      error: { code: "E_DIV_ZERO" },
    });
  });

  it("L-14 + on two str concatenates; str with a number → E_TYPE", () => {
    expect(evalExpr(bin("+", str("a"), str("b"))).data).toBe("ab");
    expect(evalExpr(bin("+", num(1), str("b"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });

  it("L-15 ordering between a number and a str → E_TYPE", () => {
    expect(evalExpr(bin("<", num(1), str("a"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "int", right: "str" } },
    });
  });

  it("L-16 == compares numbers by value, strings by value, lists and dicts structurally, objects by identity", () => {
    expect(evalExpr(bin("==", num(1), float(1))).data).toBe(true);
    expect(evalExpr(bin("==", str("a"), str("a"))).data).toBe(true);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: [1, [2]], q: [1, [2]] }).data).toBe(true);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: { a: 1 }, q: { a: 1 } }).data).toBe(true);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: { a: 1 }, q: { a: 2 } }).data).toBe(false);
    const objects = { p: { $cls: "P", x: 1 }, q: { $cls: "P", x: 1 } };
    expect(evalExpr(bin("==", v("p"), v("q")), objects).data).toBe(false);
    expect(evalExpr(bin("==", v("p"), v("p")), objects).data).toBe(true);
    expect(evalExpr(bin("==", num(1), str("1"))).data).toBe(false);
  });

  it("L-16 == compares a bool and a number as 0 or 1 and the number, as Python does", () => {
    expect(evalExpr(bin("==", bool(true), num(1))).data).toBe(true);
    expect(evalExpr(bin("==", num(0), bool(false))).data).toBe(true);
    expect(evalExpr(bin("==", bool(true), float(1))).data).toBe(true);
    expect(evalExpr(bin("!=", num(2), bool(true))).data).toBe(true);
    expect(evalExpr(bin("==", bool(true), str("1"))).data).toBe(false);
    expect(evalExpr(bin("==", v("p"), v("q")), { p: [1, 0], q: [true, false] }).data).toBe(true);
    expect(evalExpr(bin("in", num(0), v("xs")), { xs: [false] }).data).toBe(true);
  });

  it("R-15 a bool is still no number for arithmetic and ordering", () => {
    for (const op of ["+", "<"] as const) {
      expect(evalExpr(bin(op, bool(true), num(1))).done).toMatchObject({
        type: "error",
        error: { code: "E_TYPE", params: { left: "bool", right: "int" } },
      });
    }
  });

  it("L-17 and / or short-circuit and return the deciding operand", () => {
    expect(evalExpr(bin("or", num(0), num(5))).data).toBe(5);
    expect(evalExpr(bin("and", num(0), bin("/", num(1), num(0)))).data).toBe(0);
  });

  it('L-18 false values: 0, 0.0, "", [], {}, None, False', () => {
    const falsy = [num(0), float(0), str(""), none(), bool(false)];
    for (const value of falsy) expect(evalExpr(not(value)).data).toBe(true);
    expect(evalExpr(not(v("xs")), { xs: [] }).data).toBe(true);
    expect(evalExpr(not(v("d")), { d: {} }).data).toBe(true);
    expect(evalExpr(not(num(2))).data).toBe(false);
    expect(evalExpr(not(v("xs")), { xs: [0] }).data).toBe(false);
  });

  it("L-19 in: list membership by L-16; dict key membership; str substring", () => {
    expect(evalExpr(bin("in", float(1), v("xs")), { xs: [1, 2] }).data).toBe(true);
    expect(evalExpr(bin("in", num(3), v("xs")), { xs: [1, 2] }).data).toBe(false);
    expect(evalExpr(bin("in", num(3), v("d")), { d: { "$int:3": "x" } }).data).toBe(true);
    expect(evalExpr(bin("in", str("bc"), str("abcd"))).data).toBe(true);
    expect(evalExpr(bin("in", num(1), str("a"))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });

  it("L-20 a list index is int, negative from the end, else E_INDEX (write path)", () => {
    const write = (index: number) =>
      runAll(
        program([assignTo({ kind: "index", list: v("xs"), index: num(index) }, num(0))], {
          inputs: [{ name: "xs", value: [1, 2] }],
        }),
      );
    expect(varData(write(-1), "xs")).toEqual([1, 0]);
    expect(write(2).done).toMatchObject({
      type: "error",
      error: { code: "E_INDEX", params: { index: 2, length: 2 } },
    });
  });

  it("L-21 dict keys are int or str, else E_TYPE (write path)", () => {
    const write = (key: ReturnType<typeof num>) =>
      runAll(
        program([assignTo({ kind: "key", dict: v("d"), key }, num(0))], {
          inputs: [{ name: "d", value: {} }],
        }),
      );
    expect(varData(write(str("k")), "d")).toEqual({ k: 0 });
    expect(varData(write(num(3)), "d")).toEqual({ "$int:3": 0 });
    expect(write(float(1.5)).done).toMatchObject({ type: "error", error: { code: "E_TYPE" } });
  });

  it("L-23 setting a field the class does not have → E_FIELD", () => {
    const stmt = assignTo({ kind: "field", obj: v("p"), field: "nope" }, num(0));
    const result = runAll(program([stmt], { inputs: [{ name: "p", value: { $cls: "P", x: 1 } }] }));
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_FIELD", params: { cls: "P", field: "nope" } },
    });
    const ok = runAll(
      program([assignTo({ kind: "field", obj: v("p"), field: "x" }, num(2))], {
        inputs: [{ name: "p", value: { $cls: "P", x: 1 } }],
      }),
    );
    expect(varData(ok, "p")).toEqual({ $cls: "P", $id: 1, x: 2 });
  });

  it("L-64 a field of a value that is no object → E_FIELD with its type name (n.x, n = 3)", () => {
    const stmt = assignTo({ kind: "field", obj: v("n"), field: "x" }, num(0));
    const result = runAll(program([stmt], { inputs: [{ name: "n", value: 3 }] }), { n: 3 });
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_FIELD", params: { cls: "int", field: "x" } },
    });
  });

  it("L-24 assignment copies the reference", () => {
    const result = runAll(
      program(
        [assign("ys", v("xs")), assignTo({ kind: "index", list: v("ys"), index: num(0) }, num(9))],
        { inputs: [{ name: "xs", value: [1] }] },
      ),
    );
    expect(varData(result, "xs")).toEqual([9]);
  });

  it("L-25 for iterates start … stop-1 with bounds evaluated once; non-int → E_TYPE", () => {
    const result = runAll(
      program([
        assign("n", num(3)),
        assign("acc", num(0)),
        for_("i", num(1), v("n"), [
          assign("n", num(100)),
          assign("acc", bin("+", v("acc"), v("i"))),
        ]),
      ]),
    );
    expect(varData(result, "acc")).toBe(3);
    expect(runAll(program([for_("i", str("a"), num(1), [])])).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });

  it("L-29 print uses Python str(): True, None, 2.0, [1, 2], {'a': 1}, Value(data=2.0, grad=0.0, prev=[], op='')", () => {
    const inputs = {
      xs: [1, 2],
      d: { a: 1 },
      val: { $cls: "Value", data: { $float: 2 }, grad: { $float: 0 }, prev: [], op: "" },
    };
    const result = runAll(
      program(
        [
          print(bool(true)),
          print(none()),
          print(float(2)),
          print(v("xs")),
          print(v("d")),
          print(v("val")),
        ],
        {
          inputs: Object.entries(inputs).map(([name, value]) => ({ name, value })),
        },
      ),
      inputs,
    );
    expect(result.stdout).toEqual([
      "True",
      "None",
      "2.0",
      "[1, 2]",
      "{'a': 1}",
      "Value(data=2.0, grad=0.0, prev=[], op='')",
    ]);
  });

  it("L-31 a run stops with E_STEP_LIMIT after 1,000,000 events", () => {
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

  it("L-32 random_int draws are seeded per run", () => {
    const prog = program([assign("x", call("random_int", num(1), num(100)))]);
    expect(runAll(prog, {}, 1).draws).toEqual(runAll(prog, {}, 1).draws);
    expect(runAll(prog, {}, 1).draws).not.toEqual(runAll(prog, {}, 2).draws);
  });
});

describe("R-09 codes reachable with basic and control blocks", () => {
  it("E_ARITY for a builtin called with the wrong number of arguments", () => {
    const e = call("min", num(1));
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_ARITY", params: { name: "min", expected: 2, got: 1 } },
    });
  });

  it("R-34 E_VALUE and E_NUMBER_TEXT carry the registry key of the failing expression as op", () => {
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
    expect(evalExpr(bin("+", v("p"), num(1)), { p: { $cls: "P", x: 1 } }).done).toMatchObject({
      type: "error",
      error: { params: { left: "P", right: "int" } },
    });
  });
});

describe("R-03, R-08, R-10 event rules", () => {
  it("R-03 per statement: enter, expression events, then the effect", () => {
    const stmt = assign("ok", bin("and", bin("<", num(1), num(2)), bin("<", num(2), num(3))));
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "compare", "compare", "write"]);
  });

  it("R-08 steps counts all events and loops counts loop events", () => {
    const result = runAll(
      program([for_("i", num(0), num(3), [exprStmt(bin("<", v("i"), num(1)))])]),
    );
    expect(result.done).toEqual({ type: "done", steps: 1 + 3 * 3, loops: 3 });
  });

  it("R-10 the same program, inputs, and seed produce the same event sequence", () => {
    const prog = program([
      for_("i", num(0), num(5), [assign("x", call("random_int", num(0), num(9)))]),
    ]);
    expect(runAll(prog, {}, 3).events).toEqual(runAll(prog, {}, 3).events);
  });

  it("R-01 state() exposes the main frame and heap; stdout() the printed lines", () => {
    const result = runAll(program([assign("x", num(1)), print(v("x"))]));
    expect(result.state.frames).toHaveLength(1);
    expect(result.state.frames[0]?.fn).toBe("main");
    expect(result.stdout).toEqual(["1"]);
  });
});

describe("L-29 text forms", () => {
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
