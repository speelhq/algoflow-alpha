// L-56: import validates and migrates by version (L-53).
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { MigrateError, migrate } from "./migrate";

const { assign, print, num, bin, v, for_ } = ast;

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("migrate (L-53)", () => {
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
      "inputs[0]: expected { name, kind }, a kind of number, text, truefalse, none, list, dict, object",
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

  it("L-55: drops a comment statement at any depth", () => {
    const p = program([assign("x", num(1)), for_("i", num(0), num(3), [print(v("i"))])]);
    const stored = json(p) as { main: Array<Record<string, unknown>> };
    const note = { id: "c0000000000c", kind: "comment", text: "note" };
    stored.main.splice(1, 0, note);
    (stored.main[2]!.body as unknown[]).unshift({ ...note, id: "c0000000001c" });
    expect(migrate(stored)).toEqual(p);
  });

  it("L-58: keeps a statement's name and rejects one that is not one line of text", () => {
    const named = { ...assign("x", num(1)), name: "Start at one" };
    expect(migrate(json(program([named])))).toEqual(program([named]));
    const broken = json(program([{ ...named, name: "two\nlines" }]));
    expect(() => migrate(broken)).toThrow(/^main\[0\]\.name: expected one line of text/);
    const loose = migrate(
      json(
        program([
          { ...named, name: "  Start  " },
          { ...named, name: " " },
        ]),
      ),
    );
    expect(loose.main.map((stmt) => stmt.name)).toEqual(["Start", undefined]);
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
      migrate({ ...p, classes: [{ id: "c0000000000c", name: "C", fields: [null] }] }),
    ).toThrow(/^classes\[0\]\.fields\[0\]/);
    expect(() =>
      migrate({ ...p, functions: [{ id: "f0000000000f", name: "f", params: [null], body: [] }] }),
    ).toThrow(/^functions\[0\]\.params\[0\]/);
    const badTarget = json(program([assign("x", num(1))])) as {
      main: Array<Record<string, unknown>>;
    };
    badTarget.main[0]!.target = "x";
    expect(() => migrate(badTarget)).toThrow(/^main\[0\]\.target: expected a target/);
  });
});
