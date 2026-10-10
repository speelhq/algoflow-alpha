// L-56: each edit of L-50 does what it says, leaves the input untouched, and preserves L-04.
import { describe, expect, it } from "vitest";
import { ast, program, withInputs } from "@/nodes/testing";
import {
  addClass,
  addFunction,
  duplicateStmt,
  hoistAssign,
  insertStmt,
  locateStmt,
  moveStmt,
  removeClass,
  removeFunction,
  removeItem,
  removeStmt,
  renameName,
  setExpr,
  setFields,
  setParams,
  setSlot,
  setStmtName,
} from "./edit";
import { unparse } from "@/python/emit";
import { emit } from "@/python/emit";
import type { Data, Program, Stmt } from "./types";
import { validate } from "./validate";

const { assign, print, num, str, bin, v, if_, for_, call, exprStmt } = ast;

function idsUnique(p: Program): boolean {
  return !validate(p).some((d) => d.code === "E_DUPLICATE_ID");
}

function lines(p: Program, inputs: Record<string, Data> = {}): string[] {
  return emit(p, inputs).code.trimEnd().split("\n");
}

function sample(): { p: Program; a: Stmt; loop: Stmt; inner: Stmt; b: Stmt } {
  const a = assign("x", num(1));
  const inner = assign("x", bin("+", v("x"), v("i")));
  const loop = for_("i", num(0), num(3), [inner]);
  const b = print(v("x"));
  return { p: program([a, loop, b]), a, loop, inner, b };
}

describe("edit (L-50)", () => {
  it("every edit returns a new Program and leaves the input unchanged", () => {
    const { p, a } = sample();
    const before = structuredClone(p);
    const next = removeStmt(p, a.id);
    expect(p).toEqual(before);
    expect(next).not.toBe(p);
    expect(next.main).toHaveLength(2);
  });

  it("insertStmt places a statement at a Place (L-54) and re-ids a colliding statement (L-51)", () => {
    const { p, a, loop } = sample();
    const next = insertStmt(p, print(str("hi")), { parent: loop.id, slot: "body", index: 0 });
    expect(lines(next)).toEqual([
      "x = 1",
      "for i in range(3):",
      '    print("hi")',
      "    x = x + i",
      "print(x)",
    ]);
    const collided = insertStmt(p, a, { parent: "main", slot: "main", index: 99 });
    expect(collided.main).toHaveLength(4);
    expect(collided.main[3]?.id).not.toBe(a.id);
    expect(idsUnique(collided)).toBe(true);
  });

  it("moveStmt removes then inserts, counting the index after removal", () => {
    const { p, a, loop, b } = sample();
    const next = moveStmt(p, a.id, { parent: "main", slot: "main", index: 2 });
    expect(next.main.map((s) => s.id)).toEqual([loop.id, b.id, a.id]);
    const into = moveStmt(p, b.id, { parent: loop.id, slot: "body", index: 1 });
    expect(lines(into)).toEqual(["x = 1", "for i in range(3):", "    x = x + i", "    print(x)"]);
    expect(idsUnique(into)).toBe(true);
  });

  it("removeStmt removes a frame with its contents; a missing id throws", () => {
    const { p, loop, inner } = sample();
    const next = removeStmt(p, loop.id);
    expect(lines(next)).toEqual(["x = 1", "print(x)"]);
    expect(locateStmt(next, inner.id)).toBeUndefined();
    expect(() => removeStmt(p, "nope00000000")).toThrow(/no statement/);
  });

  it("duplicateStmt inserts a deep copy with fresh ids right after the original", () => {
    const { p, loop } = sample();
    const next = duplicateStmt(p, loop.id);
    expect(lines(next)).toEqual([
      "x = 1",
      "for i in range(3):",
      "    x = x + i",
      "for i in range(3):",
      "    x = x + i",
      "print(x)",
    ]);
    expect(next.main[2]?.id).not.toBe(loop.id);
    expect(idsUnique(next)).toBe(true);
  });

  it("setSlot sets id, text, and target slots; expression slots are refused", () => {
    const { p, loop, a } = sample();
    expect(lines(setSlot(p, loop.id, "var", "k"))[1]).toBe("for k in range(3):");
    expect(lines(setSlot(p, a.id, "target", { kind: "var", name: "y" }))[0]).toBe("y = 1");
    const sum = bin("+", num(1), num(2));
    expect(lines(setSlot(program([print(sum)]), sum.id, "op", "-"))).toEqual(["print(1 - 2)"]);
    expect(() => setSlot(p, a.id, "value", "x")).toThrow(/no settable slot/);
  });

  it("L-58: setStmtName stores one trimmed line and removes an empty name", () => {
    const { p, loop } = sample();
    const named = setStmtName(p, loop.id, "  Count  to\n three ");
    expect(locateStmt(named, loop.id)?.stmt.name).toBe("Count to three");
    expect(idsUnique(named)).toBe(true);
    expect(locateStmt(p, loop.id)?.stmt.name).toBeUndefined();
    const cleared = setStmtName(named, loop.id, " \n ");
    expect(locateStmt(cleared, loop.id)?.stmt).not.toHaveProperty("name");
    expect(() => setStmtName(p, "missing00000", "x")).toThrow(/no statement/);
  });

  it("setExpr replaces an expression slot, an exprs item, or a nested expression node", () => {
    const { p, a, inner, b } = sample();
    expect(lines(setExpr(p, a.id, "value", num(42)))[0]).toBe("x = 42");
    expect(lines(setExpr(p, b.id, "args", str("done"), 0))[3]).toBe('print("done")');
    expect(lines(setExpr(p, b.id, "args", str("more")))[3]).toBe('print(x, "more")');
    const binop = (inner as Extract<Stmt, { kind: "assign" }>).value;
    expect(lines(setExpr(p, binop.id, "right", num(2)))[2]).toBe("    x = x + 2");
    const reused = setExpr(p, a.id, "value", (inner as Extract<Stmt, { kind: "assign" }>).value);
    expect(idsUnique(reused)).toBe(true);
    expect(unparse((reused.main[0] as Extract<Stmt, { kind: "assign" }>).value)).toBe("x + i");
  });

  it("setExpr keeps the ids of the expression it wraps (L-51)", () => {
    const { p, a } = sample();
    const value = (a as Extract<Stmt, { kind: "assign" }>).value;
    const wrapped = bin("+", value, ast.empty());
    const next = setExpr(p, a.id, "value", wrapped);
    const placed = (next.main[0] as Extract<Stmt, { kind: "assign" }>).value;
    expect(placed.id).toBe(wrapped.id);
    expect(placed.kind === "binop" && placed.left.id).toBe(value.id);
    expect(idsUnique(next)).toBe(true);
  });

  it("removeItem removes one item of an exprs slot; other slots are refused", () => {
    const b = print(num(1), num(2), num(3));
    const p = program([b]);
    expect(lines(removeItem(p, b.id, "args", 1))).toEqual(["print(1, 3)"]);
    expect(() => removeItem(p, b.id, "args", 3)).toThrow(/no item/);
    const { p: q, a } = sample();
    expect(() => removeItem(q, a.id, "value", 0)).toThrow(/no item/);
  });

  it("setParams replaces a function's parameters", () => {
    const p = addFunction(program([]), "f", ["a"]);
    const fn = p.functions[0];
    if (!fn) throw new Error("no function");
    expect(setParams(p, fn.id, ["a", "b"]).functions[0]?.params).toEqual(["a", "b"]);
    expect(() => setParams(p, "nope00000000", [])).toThrow(/no function/);
  });

  it("setExpr addresses a target's expression as target.<field>", () => {
    const stmt = ast.assignTo({ kind: "index", list: v("xs"), index: num(0) }, num(9));
    const p = program([stmt]);
    expect(lines(setExpr(p, stmt.id, "target.index", num(2)))).toEqual(["xs[2] = 9"]);
    expect(() => setExpr(p, stmt.id, "target.nope", num(2))).toThrow(/no expression field/);
    const plain = assign("x", num(1));
    expect(() => setExpr(program([plain]), plain.id, "target.list", num(2))).toThrow(
      /no expression field/,
    );
  });

  it("renameName rewrites variables, loop variables, function names and calls, and class names", () => {
    const { p } = sample();
    const renamed = renameName(p, "x", "total");
    expect(lines(renamed)).toEqual([
      "total = 1",
      "for i in range(3):",
      "    total = total + i",
      "print(total)",
    ]);
    const withFn = program([exprStmt(call("f", num(1)))], {
      functions: [{ id: "f0000000000f", name: "f", params: ["x"], body: [print(v("x"))] }],
    });
    const fnRenamed = renameName(withFn, "f", "g");
    expect(fnRenamed.functions[0]?.name).toBe("g");
    expect(lines(fnRenamed).at(-1)).toBe("g(1)");
    expect(lines(fnRenamed)[1]).toBe("    print(x)");
    const withClass = program([]);
    withClass.classes = [{ id: "c0000000000c", name: "P", fields: [] }];
    expect(renameName(withClass, "P", "Point").classes[0]?.name).toBe("Point");
  });

  it("addFunction / removeFunction / addClass / removeClass / setFields", () => {
    let p = addFunction(program([]), "f", ["a"]);
    expect(p.functions).toEqual([{ id: expect.any(String), name: "f", params: ["a"], body: [] }]);
    p = addClass(p, "Value");
    expect(p.classes[0]).toMatchObject({ name: "Value", fields: [] });
    p = setFields(p, p.classes[0]!.id, [{ name: "data", default: { $float: 0 } }]);
    expect(p.classes[0]?.fields).toEqual([{ name: "data", default: { $float: 0 } }]);
    expect(idsUnique(p)).toBe(true);
    p = removeClass(p, p.classes[0]!.id);
    p = removeFunction(p, p.functions[0]!.id);
    expect(p.classes).toEqual([]);
    expect(p.functions).toEqual([]);
    expect(() => removeFunction(p, "nope00000000")).toThrow(/no function/);
  });

  it("hoistAssign inserts `name = <default of the same type>` before the frame (L-41)", () => {
    const frame = if_(v("c"), [assign("x", num(1))], [assign("s", str("a"))]);
    const { program: p, inputs } = withInputs({ c: 1 }, [frame, print(v("x"))]);
    expect(validate(p).map((d) => d.code)).toEqual(["E_DECLARE_FIRST"]);
    const fixed = hoistAssign(p, frame.id, "x");
    expect(lines(fixed, inputs)[1]).toBe("x = 0");
    expect(validate(fixed)).toEqual([]);
    expect(lines(hoistAssign(p, frame.id, "s"), inputs)[1]).toBe('s = ""');
    const floatFrame = if_(v("c"), [assign("y", ast.float(1.5))]);
    const floats = withInputs({ c: 1 }, [floatFrame]);
    expect(lines(hoistAssign(floats.program, floatFrame.id, "y"), inputs)[1]).toBe("y = 0.0");
    expect(lines(hoistAssign(p, frame.id, "unknown"), inputs)[1]).toBe("unknown = None");
  });
});
