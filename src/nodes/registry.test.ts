// N-02, N-09, N-16: what every registered block owes the catalog and the chart.
import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import { flatten } from "@/i18n/flatten";
import { CATEGORIES } from "./categories";
import { NODES } from "./registry";
import type { ChartShape } from "./types";

const keys = new Set(Object.keys(flatten(en)));

function regionsIn(chart: ChartShape): string[] {
  if ("branch" in chart) return [chart.branch.yes, chart.branch.no];
  if ("jump" in chart) return [];
  return "check" in chart ? [chart.check.body] : [chart.counted];
}

/** The slot a diamond's condition is in, for the shapes that draw one. */
function conditionIn(chart: ChartShape): string | undefined {
  if ("branch" in chart) return chart.branch.cond;
  return "check" in chart ? chart.check.cond : undefined;
}

describe("registry (N-02, N-09, N-16)", () => {
  it("N-01: the categories are in menu order", () => {
    expect(CATEGORIES).toEqual(["basic", "control", "list", "function", "dict", "class"]);
  });

  it("N-09: break jumps out of the innermost loop and continue into its next pass", () => {
    expect(NODES.get("break")?.chart).toEqual({ jump: "exit" });
    expect(NODES.get("continue")?.chart).toEqual({ jump: "next" });
  });

  it("N-02: every block has label, template, and help", () => {
    for (const key of NODES.keys()) {
      for (const part of ["label", "template", "help"]) {
        expect(keys.has(`node.${key}.${part}`), `node.${key}.${part}`).toBe(true);
      }
    }
  });

  it("N-08: binop writes school symbols, and %, //, **, and in in words", () => {
    const binop = NODES.get("binop");
    const node = (op: string) => ({ id: "b", kind: "binop", op }) as never;
    const symbols = ["+", "-", "*", "/", "==", "!=", "<", "<=", ">", ">=", "and", "or"].map((op) =>
      binop?.text?.(node(op), "op"),
    );
    expect(symbols).toEqual(["+", "−", "×", "÷", "=", "≠", "<", "≤", ">", "≥", "and", "or"]);
    const forms = ["%", "//", "**", "in", "+"].map((op) =>
      binop?.form?.(node(op), { creates: false }),
    );
    expect(forms).toEqual(["Mod", "FloorDiv", "Pow", "In", ""]);
    for (const form of ["Mod", "FloorDiv", "Pow", "In"]) {
      expect(keys.has(`node.binop.template${form}`), form).toBe(true);
    }
  });

  it("N-11: expression blocks declare the value list's entries in the table's order", () => {
    const any = "number,text,truefalse,none,list,dict,object";
    const rows = [...NODES.values()].flatMap((def) =>
      (def.menu ?? []).map((entry) =>
        [
          def.key,
          entry.name,
          entry.group,
          entry.on?.join(",") ?? "",
          entry.symbol ?? "",
          entry.keys ?? "",
        ].join(" | "),
      ),
    );
    expect(rows).toEqual([
      "str |  | values |  |  | ",
      "bool | true | values |  |  | ",
      "bool | false | values |  |  | ",
      "none |  | values |  |  | ",
      "unop | not | conditions |  |  | not",
      "call:random_int |  | calculate |  |  | ",
      "binop | and | conditions | truefalse |  | and",
      "binop | or | conditions | truefalse |  | or",
      "binop | add | calculate | number,text | + | +",
      "binop | sub | calculate | number | − | -",
      "binop | mul | calculate | number | × | *",
      "binop | div | calculate | number | ÷ | /",
      "binop | mod | calculate | number |  | %",
      "binop | floorDiv | calculate | number |  | //",
      "binop | pow | calculate | number |  | **",
      "binop | join | items | list | + | ",
      `binop | eq | compare | ${any} | = | ==`,
      `binop | ne | compare | ${any} | ≠ | !=`,
      "binop | lt | compare | number,text | < | <",
      "binop | le | compare | number,text | ≤ | <=",
      "binop | gt | compare | number,text | > | >",
      "binop | ge | compare | number,text | ≥ | >=",
      `binop | in | compare | ${any} |  | in`,
      "call:abs |  | calculate | number |  | ",
      "call:max |  | calculate | number,text |  | ",
      "call:min |  | calculate | number,text |  | ",
      `call:str |  | convert | ${any} |  | `,
      "call:int |  | convert | number,text |  | ",
      "call:float |  | convert | number,text |  | ",
    ]);
  });

  it("N-02: a named entry has its label and help, and a help names the entry's keys", () => {
    for (const def of NODES.values()) {
      for (const entry of def.menu ?? []) {
        const base = entry.name === "" ? `node.${def.key}` : `node.${def.key}.${entry.name}`;
        expect(keys.has(`${base}.label`), `${base}.label`).toBe(true);
        const help = flatten(en)[`${base}.help`] ?? "";
        if (entry.keys) expect(help.endsWith(`Type \`${entry.keys}\`.`), base).toBe(true);
      }
    }
  });

  it("N-09: a chart names the body slots of its block, and a diamond's condition an expr slot", () => {
    const shaped = [...NODES.values()].filter((def) => def.chart);
    expect(new Set(shaped.map((def) => def.key))).toEqual(
      new Set(["if", "while", "for", "break", "continue"]),
    );
    for (const def of shaped) {
      const regions = def.chart ? regionsIn(def.chart) : [];
      const bodies = def.slots.filter((slot) => slot.role === "body").map((slot) => slot.name);
      expect(new Set(regions)).toEqual(new Set(bodies));
      const cond = def.chart ? conditionIn(def.chart) : undefined;
      if (cond !== undefined) {
        expect(def.slots.find((slot) => slot.name === cond)?.role, def.key).toBe("expr");
      }
    }
  });

  it("N-16: a counted loop has the texts of init, check, and step", () => {
    for (const def of NODES.values()) {
      if (!def.chart || !("counted" in def.chart)) continue;
      for (const part of ["init", "check", "step"]) {
        expect(keys.has(`node.${def.key}.${part}`), `node.${def.key}.${part}`).toBe(true);
      }
    }
  });
});
