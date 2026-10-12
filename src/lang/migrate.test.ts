// Import validates and migrates by version; it refuses a literal field its block would not make,
// a class, and an object input.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { MigrateError, migrate } from "./migrate";

const { assign, print, num, float, str, bool, not, bin, v, for_, ret } = ast;

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("migrate", () => {
  it("accepts a version 1 program unchanged", () => {
    const p = program(
      [assign("x", num(1)), for_("i", num(0), num(3), [print(bin("+", v("x"), v("i")))])],
      {
        inputs: [{ name: "n", kind: "list" }],
        functions: [{ id: "f0000000000f", name: "f", params: ["a"], body: [print(v("a"))] }],
      },
    );
    expect(migrate(json(p))).toEqual(p);
  });

  it("rejects an input that is not a name with a known kind", () => {
    const valued = { ...program([]), inputs: [{ name: "n", value: [1, 2] }] };
    expect(() => migrate(valued)).toThrow(/^inputs\[0\]: expected \{ name, kind \}/);
    const unknown = { ...program([]), inputs: [{ name: "n", kind: "word" }] };
    expect(() => migrate(unknown)).toThrow(
      "inputs[0]: expected { name, kind }, a kind of number, text, truefalse, none, list, dict",
    );
    expect(() => migrate({ ...program([]), inputs: [{ kind: "list" }] })).toThrow(
      /^inputs\[0\]: expected \{ name, kind \}/,
    );
  });

  it("rejects an unsupported version with the path", () => {
    expect(() => migrate({ ...program([]), version: 2 })).toThrow(MigrateError);
    expect(() => migrate({ ...program([]), version: 2 })).toThrow(
      /^version: unsupported version 2/,
    );
    expect(() => migrate("nope")).toThrow(/expected a program object/);
  });

  it("rejects missing or malformed fields with their path", () => {
    const { main: _omit, ...noMain } = program([]);
    expect(() => migrate(noMain)).toThrow(/^main: expected an array/);
    expect(() => migrate({ ...program([]), inputs: [{ name: 1 }] })).toThrow(/^inputs\[0\]/);
    expect(() => migrate({ ...program([]), functions: [{ id: "f", name: "f" }] })).toThrow(
      /^functions\[0\]/,
    );
  });

  it("rejects unknown statement and expression kinds and nodes without ids", () => {
    const bad = json(program([assign("x", num(1))])) as { main: Array<Record<string, unknown>> };
    bad.main[0]!.kind = "lambda";
    expect(() => migrate(bad)).toThrow(/^main\[0\]\.kind: unknown kind "lambda"/);
    const badExpr = json(program([assign("x", bin("+", num(1), num(2)))])) as {
      main: Array<{ value: { right: Record<string, unknown> } }>;
    };
    badExpr.main[0]!.value.right.kind = "await";
    expect(() => migrate(badExpr)).toThrow(/^main\[0\]\.value\.right\.kind/);
    const noId = json(program([print(num(1))])) as {
      main: Array<{ args: Array<Record<string, unknown>> }>;
    };
    delete noId.main[0]!.args[0]!.id;
    expect(() => migrate(noId)).toThrow(/^main\[0\]\.args\[0\]\.id/);
  });

  it("rejects a missing required value, a name that is no text, and a region that is no list", () => {
    type Stored = { main: Array<Record<string, unknown>> };
    const noValue = json(program([assign("x", num(1))])) as Stored;
    delete noValue.main[0]!.value;
    expect(() => migrate(noValue)).toThrow(/^main\[0\]\.value: expected an expression/);
    const badVar = json(program([for_("i", num(0), num(3), [])])) as Stored;
    badVar.main[0]!.var = 3;
    expect(() => migrate(badVar)).toThrow(/^main\[0\]\.var: expected a name/);
    const badRegion = json(program([for_("i", num(0), num(3), [])])) as Stored;
    badRegion.main[0]!.body = "nothing";
    expect(() => migrate(badRegion)).toThrow(/^main\[0\]\.body: expected an array/);
    // An optional value may be absent.
    const fn = { id: "f0000000000f", name: "f", params: [], body: [ret()] };
    const bare = program([], { functions: [fn] });
    expect(migrate(json(bare))).toEqual(bare);
  });

  it("rejects a statement of a kind no block reads, at any depth", () => {
    const p = program([for_("i", num(0), num(3), [print(v("i"))])]);
    const stored = json(p) as { main: Array<Record<string, unknown>> };
    (stored.main[0]!.body as unknown[]).unshift({ id: "c0000000000c", kind: "comment" });
    expect(() => migrate(stored)).toThrow(/^main\[0\]\.body\[0\]\.kind: unknown kind "comment"/);
  });

  it("stores a statement's name as an edit does and rejects one that is not one line of text", () => {
    const named = { ...assign("x", num(1)), name: "Start at one" };
    expect(migrate(json(program([named])))).toEqual(program([named]));
    const broken = json(program([{ ...named, name: "two\nlines" }]));
    expect(() => migrate(broken)).toThrow(/^main\[0\]\.name: expected one line of text/);
    const loose = migrate(
      json(
        program([
          { ...named, name: "  Start  " },
          { ...named, name: " " },
          { ...named, name: "Start \t at  one" },
        ]),
      ),
    );
    expect(loose.main.map((stmt) => stmt.name)).toEqual(["Start", undefined, "Start at one"]);
    expect(loose.main[1]).not.toHaveProperty("name");
    expect(() => migrate(json(program([{ ...named, name: 3 } as never])))).toThrow(
      /^main\[0\]\.name/,
    );
  });

  it("checks id shape, field and parameter elements, and target shape", () => {
    const shortId = json(program([assign("x", num(1))])) as {
      main: Array<Record<string, unknown>>;
    };
    shortId.main[0]!.id = "x";
    expect(() => migrate(shortId)).toThrow(/^main\[0\]\.id: expected a 12-character node id/);
    const p = program([]);
    expect(() =>
      migrate({ ...p, functions: [{ id: "f0000000000f", name: "f", params: [null], body: [] }] }),
    ).toThrow(/^functions\[0\]\.params\[0\]/);
    const badTarget = json(program([assign("x", num(1))])) as {
      main: Array<Record<string, unknown>>;
    };
    badTarget.main[0]!.target = "x";
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target: expected a target/);
    badTarget.main[0]!.target = { kind: "slice" };
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target: expected a target/);
    badTarget.main[0]!.target = { kind: "var", name: 3 };
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target\.name: expected a name/);
    badTarget.main[0]!.target = { kind: "index", list: v("xs") };
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target\.index: expected an expression/);
  });

  it("refuses a literal field its block would not make, at its path", () => {
    const valueOf = (expr: unknown) => json(program([assign("x", expr as never)]));
    const at = (fields: Record<string, unknown>, of: unknown) => {
      const p = valueOf(of) as { main: Array<{ value: Record<string, unknown> }> };
      Object.assign(p.main[0]!.value, fields);
      return () => migrate(p);
    };
    expect(() => migrate(valueOf(num(7)))).not.toThrow();
    expect(() => migrate(valueOf(float(2, "2.0")))).not.toThrow();
    expect(() => migrate(valueOf(num(2 ** 53 - 1)))).not.toThrow();
    expect(at({ raw: "007", value: 7 }, num(7))).toThrow(
      /^main\[0\]\.value\.raw: expected a number literal/,
    );
    expect(at({ raw: "9007199254740992", value: 2 ** 53 }, num(1))).toThrow(
      /value\.raw: expected a number/,
    );
    expect(at({ raw: "-3", value: -3 }, num(1))).toThrow(/value\.raw: expected a number/);
    expect(at({ value: 8 }, num(7))).toThrow(
      /^main\[0\]\.value\.value: expected the number raw writes/,
    );
    expect(at({ float: true }, num(7))).toThrow(/value\.float: expected whether raw/);
    expect(at({ float: false }, float(2, "2.0"))).toThrow(/value\.float: expected whether raw/);
    expect(at({ op: "^" }, bin("+", num(1), num(2)))).toThrow(
      /value\.op: expected a known operator/,
    );
    expect(at({ op: "neg!" }, not(v("a")))).toThrow(/value\.op: expected a known operator/);
    expect(at({ value: 3 }, str("a"))).toThrow(/value\.value: expected a text/);
    expect(at({ value: "yes" }, bool(true))).toThrow(/value\.value: expected true or false/);
  });

  it("refuses a class and an input of the kind object, while no block constructs one", () => {
    const cls = { id: "c0000000000c", name: "C", fields: [] };
    expect(() => migrate({ ...program([]), classes: [cls] })).toThrow(
      "classes[0]: expected no class: no block constructs an object",
    );
    const object = { ...program([]), inputs: [{ name: "p", kind: "object" }] };
    expect(() => migrate(object)).toThrow(/^inputs\[0\]: expected \{ name, kind \}/);
  });
});
