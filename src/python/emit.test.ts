// E-01, E-02, E-03, E-04, E-05, E-06 and E-10.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { dataToPython, emit, pyString, unparse } from "./emit";
import { EXPRESSION_FIXTURE } from "./fixtures/expressions";
import { isParseError, parse } from "./parse";

const { assign, print, if_, for_, while_, num, str, bin, v, call } = ast;

const CR = String.fromCharCode(13);
const SOH = String.fromCharCode(1);
const DEL = String.fromCharCode(127);

describe("emit (emitter.md)", () => {
  it("E-01: 1-based inclusive lines; a frame maps to its header; else: is unmapped", () => {
    const inner = assign("x", num(1));
    const frame = if_(bin("<", v("a"), v("b")), [inner], [assign("x", num(2))]);
    const after = print(v("x"));
    const { code, map } = emit(program([frame, after]));
    expect(code).toBe("if a < b:\n    x = 1\nelse:\n    x = 2\nprint(x)\n");
    expect(map[frame.id]).toEqual({ start: 1, end: 1 });
    expect(map[inner.id]).toEqual({ start: 2, end: 2 });
    expect(map[after.id]).toEqual({ start: 5, end: 5 });
    expect(Object.values(map).some((m) => m.start === 3)).toBe(false);
  });

  it("E-02: sections separated by one blank line, two around classes and functions", () => {
    const prog = program([assign("d", call("random_int", num(1), num(6)))], {
      inputs: [{ name: "n", value: 3 }],
      functions: [
        {
          id: "f0000000000f",
          name: "twice",
          params: ["x"],
          body: [print(bin("*", v("x"), num(2)))],
        },
      ],
    });
    prog.classes = [
      {
        id: "c0000000000c",
        name: "Value",
        fields: [
          { name: "data", default: { $float: 0 } },
          { name: "grad", default: { $float: 0 } },
          { name: "prev", default: [] },
          { name: "op", default: "" },
        ],
      },
    ];
    const { code, map } = emit(prog);
    expect(code).toBe(
      [
        "import random",
        "",
        "",
        "class Value:",
        '    def __init__(self, data=0.0, grad=0.0, prev=None, op=""):',
        "        self.data = data",
        "        self.grad = grad",
        "        self.prev = [] if prev is None else prev",
        "        self.op = op",
        "",
        "    def __repr__(self):",
        '        return f"Value(data={self.data!r}, grad={self.grad!r}, prev={self.prev!r}, op={self.op!r})"',
        "",
        "",
        "def twice(x):",
        "    print(x * 2)",
        "",
        "",
        "n = 3",
        "d = random.randint(1, 6)",
        "",
      ].join("\n"),
    );
    expect(map["c0000000000c"]).toEqual({ start: 4, end: 4 });
    expect(map["f0000000000f"]).toEqual({ start: 15, end: 15 });
  });

  it("E-11: a named statement is preceded by its name as a comment, where its map entry starts", () => {
    const inner = { ...print(v("i")), name: "Show it" };
    const loop = { ...for_("i", num(0), num(3), [inner]), name: "Count to three" };
    const { code, map } = emit(program([loop]));
    expect(code).toBe("# Count to three\nfor i in range(3):\n    # Show it\n    print(i)\n");
    expect(map[loop.id]).toEqual({ start: 1, end: 2 });
    expect(map[inner.id]).toEqual({ start: 3, end: 4 });
  });

  it("E-03: inputs are emitted as assignments of their Data in declaration order", () => {
    const { code } = emit(
      program([], {
        inputs: [
          { name: "nums", value: [5, 3, 1] },
          { name: "name", value: "Claude" },
          { name: "x", value: { $float: 2 } },
          { name: "d", value: { a: 1, "$int:2": [true, null] } },
        ],
      }),
    );
    expect(code).toBe(
      'nums = [5, 3, 1]\nname = "Claude"\nx = 2.0\nd = {"a": 1, 2: [True, None]}\n',
    );
    expect(dataToPython(1.5)).toBe("1.5");
    expect(dataToPython(1e-7)).toBe("1e-07");
  });

  it("E-03: integral inputs beyond 1e21 stay integer literals", () => {
    expect(dataToPython(1e21)).toBe("1000000000000000000000");
    expect(dataToPython(12)).toBe("12");
  });

  it("E-04: 4-space indentation, no trailing whitespace, one trailing newline", () => {
    const { code } = emit(program([for_("i", num(0), num(3), [while_(v("ok"), [print(v("i"))])])]));
    expect(code).toBe("for i in range(3):\n    while ok:\n        print(i)\n");
    expect(code.endsWith("\n\n")).toBe(false);
    expect(code.split("\n").some((line) => /\s$/.test(line))).toBe(false);
  });

  it("E-06: string escapes, including control characters CPython would reject raw", () => {
    expect(pyString('a"b\\c\nd\te')).toBe('"a\\"b\\\\c\\nd\\te"');
    expect(pyString(`a${CR}b${SOH}c${DEL}`)).toBe('"a\\rb\\x01c\\x7f"');
    expect(unparse(str("plain"))).toBe('"plain"');
    const roundTrip = parse(unparse(str(`a${CR}b${SOH}`)));
    expect(!isParseError(roundTrip) && unparse(roundTrip)).toBe('"a\\rb\\x01"');
  });

  it("emits an empty program as an empty file and an empty main region under inputs", () => {
    expect(emit(program([])).code).toBe("\n");
    expect(emit(program([], { inputs: [{ name: "n", value: 1 }] })).code).toBe("n = 1\n");
  });
});

describe("E-10: 200-expression fixture (E-05)", () => {
  it("has at least 200 cases", () => {
    expect(EXPRESSION_FIXTURE.length).toBeGreaterThanOrEqual(200);
  });

  for (const entry of EXPRESSION_FIXTURE) {
    const [input, expected] = typeof entry === "string" ? [entry, entry] : entry;
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      const expr = parse(input);
      if (isParseError(expr)) throw new Error(`parse failed: ${JSON.stringify(expr)}`);
      expect(unparse(expr)).toBe(expected);
    });
  }
});
