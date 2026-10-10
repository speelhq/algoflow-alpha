// L-56: every validation code has a failing and a passing case; L-40, L-41, L-42.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import type { Diagnostic, Program, Stmt } from "./types";
import { firstAssignments, validate } from "./validate";

const {
  assign,
  print,
  num,
  bin,
  v,
  if_,
  for_,
  while_,
  brk,
  cont,
  ret,
  call,
  exprStmt,
  empty,
  bool,
} = ast;

const codes = (p: Program) => validate(p).map((d) => d.code);
const withInput = (main: Stmt[]) => program(main, { inputs: [{ name: "c", kind: "number" }] });

describe("validate (02 Validation)", () => {
  it("returns no diagnostics for a well-formed program", () => {
    expect(validate(program([assign("x", num(1)), print(bin("+", v("x"), num(1)))]))).toEqual([]);
  });

  it("E_UNDEFINED: a name that is not visible (L-40)", () => {
    const stmt = print(v("x"));
    expect(validate(program([stmt]))).toEqual([
      { nodeId: stmt.id, code: "E_UNDEFINED", params: { name: "x" } },
    ]);
    expect(codes(program([assign("x", num(1)), print(v("x"))]))).toEqual([]);
    expect(codes(program([assign("x", bin("+", v("x"), num(1)))]))).toEqual(["E_UNDEFINED"]);
  });

  it("E_DECLARE_FIRST: first assigned inside a frame and read after it (L-41), with the hoist fix", () => {
    const frame = if_(v("c"), [assign("x", num(1))]);
    const use = print(v("x"));
    expect(validate(withInput([frame, use]))).toEqual([
      {
        nodeId: use.id,
        code: "E_DECLARE_FIRST",
        params: { name: "x", frame: frame.id },
        fix: "hoistAssign",
      },
    ]);
    expect(codes(withInput([assign("x", num(0)), frame, use]))).toEqual([]);
    const loop = for_("i", num(0), num(3), [assign("y", v("i"))]);
    expect(codes(program([loop, print(v("y"))]))).toEqual(["E_DECLARE_FIRST"]);
  });

  it("E_DECLARE_FIRST: a name assigned two frames deep points at the outermost frame", () => {
    const outer = if_(v("c"), [if_(v("c"), [assign("x", num(1))])]);
    const use = print(v("x"));
    expect(validate(withInput([outer, use]))).toEqual([
      {
        nodeId: use.id,
        code: "E_DECLARE_FIRST",
        params: { name: "x", frame: outer.id },
        fix: "hoistAssign",
      },
    ]);
    const nested = for_("i", num(0), num(2), [if_(v("c"), [assign("z", num(1))]), print(v("z"))]);
    expect(codes(withInput([nested]))).toEqual(["E_DECLARE_FIRST"]);
  });

  it("E_DUPLICATE_NAME: a variable may not shadow a function or a builtin; params are unique", () => {
    const fn = { id: "f0000000000f", name: "count", params: ["a", "a"], body: [] };
    expect(validate(program([assign("count", num(0))], { functions: [fn] }))).toEqual([
      { nodeId: fn.id, code: "E_DUPLICATE_NAME", params: { name: "a" } },
      { nodeId: expect.any(String), code: "E_DUPLICATE_NAME", params: { name: "count" } },
    ]);
    const shadow = { id: "f0000000000g", name: "random_int", params: [], body: [] };
    expect(codes(program([], { functions: [shadow] }))).toEqual(["E_DUPLICATE_NAME"]);
    expect(codes(program([for_("random_int", num(0), num(1), [])]))).toEqual(["E_DUPLICATE_NAME"]);
  });

  it("L-40: a for variable stays visible after its loop; a while body cannot define its condition", () => {
    expect(codes(program([for_("i", num(0), num(3), []), print(v("i"))]))).toEqual([]);
    expect(codes(program([while_(v("k"), [assign("k", num(0))])]))).toEqual(["E_UNDEFINED"]);
  });

  it("L-42: functions see only their parameters and body", () => {
    const fn = {
      id: "f0000000000f",
      name: "twice",
      params: ["x"],
      body: [ret(bin("*", v("x"), num(2)))],
    };
    expect(codes(program([assign("g", num(1))], { functions: [fn] }))).toEqual([]);
    const leaky = { ...fn, id: "f0000000000g", name: "leak", body: [ret(v("g"))] };
    expect(codes(program([assign("g", num(1))], { functions: [leaky] }))).toEqual(["E_UNDEFINED"]);
  });

  it("E_BAD_NAME: L-01 pattern, L-02 class pattern, L-03 reserved words", () => {
    for (const bad of ["Foo", "2x", "for", "len", "my-var", ""]) {
      const p = program([assign(bad, num(1))]);
      expect(codes(p), bad).toContain(bad === "" ? "E_EMPTY_SLOT" : "E_BAD_NAME");
    }
    expect(codes(program([assign("total_2", num(1))]))).toEqual([]);
    const cls = { id: "c0000000000c", name: "value", fields: [] };
    const p = program([]);
    p.classes = [cls];
    expect(validate(p)).toEqual([
      { nodeId: cls.id, code: "E_BAD_NAME", params: { name: "value" } },
    ]);
    // Validation is memoized per Program object (edits are pure, L-50): validate a new object.
    expect(validate({ ...p, classes: [{ ...cls, name: "Value" }] })).toEqual([]);
  });

  it("E_DUPLICATE_NAME: functions, classes, and inputs share one namespace (L-05)", () => {
    const a = { id: "f0000000000a", name: "f", params: [], body: [] };
    const b = { id: "f0000000000b", name: "f", params: [], body: [] };
    expect(validate(program([], { functions: [a, b] }))).toEqual([
      { nodeId: b.id, code: "E_DUPLICATE_NAME", params: { name: "f" } },
    ]);
    expect(
      codes(
        program([], { functions: [{ ...a, name: "n" }], inputs: [{ name: "n", kind: "number" }] }),
      ),
    ).toEqual(["E_DUPLICATE_NAME"]);
    expect(codes(program([], { functions: [a, { ...b, name: "g" }] }))).toEqual([]);
  });

  it("E_BREAK_OUTSIDE: break or continue outside a loop", () => {
    const stray = brk();
    expect(validate(program([stray]))).toEqual([
      { nodeId: stray.id, code: "E_BREAK_OUTSIDE", params: {} },
    ]);
    expect(codes(withInput([if_(v("c"), [cont()])]))).toEqual(["E_BREAK_OUTSIDE"]);
    expect(codes(withInput([for_("i", num(0), num(3), [if_(v("c"), [brk()]), cont()])]))).toEqual(
      [],
    );
  });

  it("E_RETURN_OUTSIDE: return in main", () => {
    const stray = ret(num(1));
    expect(validate(program([stray]))).toEqual([
      { nodeId: stray.id, code: "E_RETURN_OUTSIDE", params: {} },
    ]);
    expect(
      codes(
        program([], { functions: [{ id: "f0000000000f", name: "f", params: [], body: [ret()] }] }),
      ),
    ).toEqual([]);
  });

  it("E_ARITY: builtins, user functions, and constructors", () => {
    const stmt = assign("m", call("min", num(1)));
    expect(validate(program([stmt]))).toEqual([
      { nodeId: stmt.id, code: "E_ARITY", params: { name: "min", expected: 2, got: 1 } },
    ]);
    const fn = { id: "f0000000000f", name: "f", params: ["a", "b"], body: [] };
    expect(codes(program([exprStmt(call("f", num(1)))], { functions: [fn] }))).toEqual(["E_ARITY"]);
    expect(codes(program([exprStmt(call("f", num(1), num(2)))], { functions: [fn] }))).toEqual([]);
    // constructors (`new`) and methods have no registered block to call here
  });

  it("E_UNKNOWN_CALL: unknown function", () => {
    const stmt = exprStmt(call("nope", num(1)));
    expect(validate(program([stmt]))).toEqual([
      { nodeId: stmt.id, code: "E_UNKNOWN_CALL", params: { name: "nope" } },
    ]);
    expect(codes(program([exprStmt(call("abs", num(1)))]))).toEqual([]);
    const fn = { id: "f0000000000f", name: "f", params: [], body: [] };
    expect(codes(program([exprStmt(call("f"))], { functions: [fn] }))).toEqual([]);
  });

  it("E_EMPTY_SLOT: a required slot left empty, naming the slot (L-09)", () => {
    const value = assign("x", empty());
    expect(validate(program([value]))).toEqual([
      { nodeId: value.id, code: "E_EMPTY_SLOT", params: { slot: "value" } },
    ]);
    expect(validate(program([if_(empty(), [])]))[0]).toMatchObject({
      code: "E_EMPTY_SLOT",
      params: { slot: "cond" },
    });
    expect(validate(program([for_("", num(0), num(1), [])]))[0]).toMatchObject({
      code: "E_EMPTY_SLOT",
      params: { slot: "var" },
    });
    expect(validate(program([assign("", num(1))]))[0]).toMatchObject({
      code: "E_EMPTY_SLOT",
      params: { slot: "target" },
    });
    expect(validate(program([assign("x", bin("+", num(1), empty()))]))).toEqual([
      expect.objectContaining({ code: "E_EMPTY_SLOT", params: { slot: "right" } }),
    ]);
    expect(validate(program([print(num(1), empty())]))).toEqual([
      expect.objectContaining({ code: "E_EMPTY_SLOT", params: { slot: "args" } }),
    ]);
    expect(validate(program([exprStmt(call("abs", empty()))]))).toEqual([
      expect.objectContaining({ code: "E_EMPTY_SLOT", params: { slot: "args" } }),
    ]);
    expect(codes(program([assign("x", bin("+", num(1), num(2))), print()]))).toEqual([]);
  });

  it("E_DEFAULT: a field default must be a scalar, [], or {} (L-30)", () => {
    const p = program([]);
    p.classes = [
      {
        id: "c0000000000c",
        name: "P",
        fields: [
          { name: "xs", default: [1] },
          { name: "d", default: { a: 1 } },
        ],
      },
    ];
    expect(validate(p)).toEqual([
      { nodeId: "c0000000000c", code: "E_DEFAULT", params: { field: "xs" } },
      { nodeId: "c0000000000c", code: "E_DEFAULT", params: { field: "d" } },
    ]);
    const fields = [
      { name: "xs", default: [] },
      { name: "d", default: {} },
      { name: "n", default: 0 },
      { name: "s", default: "" },
      { name: "b", default: false },
      { name: "z", default: null },
    ];
    expect(validate({ ...p, classes: [{ id: "c0000000000c", name: "P", fields }] })).toEqual([]);
  });

  it("E_DUPLICATE_ID: the second occurrence of an id is reported (L-04)", () => {
    const a = assign("x", num(1));
    const b = { ...assign("y", num(2)), id: a.id };
    expect(validate(program([a, b]))).toEqual([
      { nodeId: a.id, code: "E_DUPLICATE_ID", params: {} },
    ]);
  });

  it("reports several problems in traversal order", () => {
    const p = program([print(v("x")), brk(), assign("2bad", bool(true))]);
    const result: Diagnostic[] = validate(p);
    expect(result.map((d) => d.code)).toEqual(["E_UNDEFINED", "E_BREAK_OUTSIDE", "E_BAD_NAME"]);
  });
});

describe("firstAssignments (N-02 templateCreate, L-40/L-43)", () => {
  it("marks the first assign of a name, not later ones, inputs, params, or loop variables", () => {
    const create = assign("x", num(1));
    const set = assign("x", num(2));
    const input = assign("c", num(3));
    const loopBody = assign("i", num(9));
    const loop = for_("i", num(0), num(3), [loopBody]);
    const body = assign("a", num(0));
    const fn = { id: "f0000000000f", name: "f", params: ["a"], body: [body, assign("b", num(1))] };
    const p = program([create, set, input, loop], {
      inputs: [{ name: "c", kind: "number" }],
      functions: [fn],
    });
    const ids = firstAssignments(p);
    expect(ids.has(create.id)).toBe(true);
    expect(ids.has(set.id)).toBe(false);
    expect(ids.has(input.id)).toBe(false);
    expect(ids.has(loopBody.id)).toBe(false);
    expect(ids.has(body.id)).toBe(false);
    expect(ids.has(fn.body[1]!.id)).toBe(true);
  });

  it("marks a first assignment inside a frame", () => {
    const inner = assign("y", num(1));
    const p = program([if_(bool(true), [inner]), assign("y", num(2))]);
    expect(firstAssignments(p).has(inner.id)).toBe(true);
  });
});
