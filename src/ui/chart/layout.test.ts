// U-92: layout() places every node of every challenge solution without overlap; loops and
// branches match U-33. Synthetic programs cover the nestings no challenge has yet.
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/challenges";
import type { Program, Stmt } from "@/lang/types";
import { allStmts, regionsOf } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes/registry";
import { ast, program, tid } from "@/nodes/testing";
import {
  layout,
  LINE,
  type ChartEdge,
  type ChartLayout,
  type ChartNode,
  type Measure,
} from "./layout";

const { assign, num, str, bin, v, print, for_, while_, if_, ret, brk, cont } = ast;

const wide: Measure = (text) => text.length * 14.4;

const lt = (name: string, n: number) => bin("<", v(name), num(n));
const chain = (depth: number): Stmt =>
  if_(lt("x", depth), [print(num(depth))], depth > 1 ? [chain(depth - 1)] : [print(str("else"))]);

const fn = (name: string, body: Stmt[]) => ({ id: tid(), name, params: ["x"], body });

const SYNTHETIC: Array<[string, Program]> = [
  ["an empty main", program([])],
  ["one statement", program([print(str("hi"))])],
  [
    "a for in a for with an if/else and a statement after the inner loop",
    program([
      for_("i", num(0), num(3), [
        for_("j", num(0), v("i"), [if_(lt("j", 1), [print(v("j"))], [print(v("i"))])]),
        print(str("row")),
      ]),
    ]),
  ],
  [
    "a while in a Yes region with a for in the No region",
    program([
      assign("x", num(0)),
      if_(
        lt("x", 3),
        [while_(lt("x", 3), [assign("x", bin("+", v("x"), num(1)))]), print(v("x"))],
        [for_("k", num(0), num(2), [print(v("k"))])],
      ),
      print(str("after")),
    ]),
  ],
  [
    "every region empty",
    program([
      assign("x", num(0)),
      if_(lt("x", 1), []),
      while_(lt("x", 0), []),
      for_("i", num(0), num(2), []),
    ]),
  ],
  ["an else-if chain five deep", program([assign("x", num(2)), chain(5)])],
  [
    "an if inside a Yes region, and a loop ending a Yes region",
    program([
      assign("x", num(0)),
      if_(lt("x", 5), [if_(lt("x", 2), [print(str("small"))]), while_(lt("x", 1), [])]),
    ]),
  ],
  [
    "a long sentence three levels deep",
    program([
      for_("i", num(0), num(2), [
        if_(lt("i", 1), [while_(lt("i", 0), [print(str("x".repeat(80)))])]),
      ]),
    ]),
  ],
  [
    "break and continue in a for, with a print after them",
    program([
      for_("i", num(0), num(9), [
        if_(lt("i", 2), [cont()]),
        if_(lt("i", 5), [], [brk()]),
        print(str("go on")),
      ]),
      print(str("after")),
    ]),
  ],
  [
    "break and continue in a while, and a while ending in break",
    program([
      assign("i", num(0)),
      while_(lt("i", 9), [
        assign("i", bin("+", v("i"), num(1))),
        if_(lt("i", 2), [cont()]),
        if_(lt("i", 5), [print(v("i"))], [brk()]),
      ]),
      while_(lt("i", 20), [assign("i", bin("+", v("i"), num(1))), brk()]),
    ]),
  ],
  [
    "a continue and a break in nested loops",
    program([
      for_("i", num(0), num(3), [
        while_(lt("i", 2), [cont()]),
        for_("j", num(0), num(2), [if_(lt("j", 1), [brk()])]),
      ]),
    ]),
  ],
];

const returning = fn("find", [
  if_(lt("x", 0), [for_("i", num(0), v("x"), [if_(lt("i", 2), [ret(v("i"))])])], [ret(num(0))]),
  while_(lt("x", 9), [ret(v("x"))]),
  ret(num(-1)),
]);
const bothReturn = fn("sign", [if_(lt("x", 0), [ret(num(-1))], [ret(num(1))])]);

type Case = { name: string; program: Program; chart?: string };
const CASES: Case[] = [
  ...CHALLENGES.map((challenge) => ({ name: challenge.id, program: challenge.solution })),
  ...SYNTHETIC.map(([name, p]) => ({ name, program: p })),
  {
    name: "returns in a loop in an if",
    program: program([], { functions: [returning] }),
    chart: returning.id,
  },
  {
    name: "both regions return",
    program: program([], { functions: [bothReturn] }),
    chart: bothReturn.id,
  },
];

const bodyOf = (c: Case): Stmt[] =>
  c.chart ? (c.program.functions.find((f) => f.id === c.chart)?.body ?? []) : c.program.main;

const lay = (c: Case, measure?: Measure): ChartLayout =>
  layout(c.program, { ...(c.chart ? { chart: c.chart } : {}), ...(measure ? { measure } : {}) });

/** A Return, or a jump (every jump of these cases is inside a loop): no edge to the next node. */
const leaves = (stmt: Stmt): boolean => {
  const def = getNode(keyOf(stmt));
  return def.requires === "function" || (def.chart !== undefined && "jump" in def.chart);
};

/** Something flows out of the bottom of the statement: not a Return or jump, nor a branch whose regions all leave. */
function flows(stmt: Stmt): boolean {
  const shape = getNode(keyOf(stmt)).chart;
  if (!shape || "jump" in shape) return !leaves(stmt);
  if (!("branch" in shape)) return true; // a loop's No edge
  return regionsOf(stmt).some((region) => {
    const final = region.stmts.at(-1);
    return final === undefined || flows(final);
  });
}

const byId = (chart: ChartLayout) => new Map(chart.nodes.map((node) => [node.id, node]));
const centre = (node: ChartNode) => node.x + node.w / 2;

function rectsOverlap(a: ChartNode, b: ChartNode, inflate: number): boolean {
  return (
    a.x - inflate < b.x + b.w + inflate &&
    b.x - inflate < a.x + a.w + inflate &&
    a.y - inflate < b.y + b.h + inflate &&
    b.y - inflate < a.y + a.h + inflate
  );
}

/** An axis-parallel segment meets the interior of `node` shrunk by 1 px. */
function crosses(a: { x: number; y: number }, b: { x: number; y: number }, node: ChartNode) {
  if (node.w === 0) return false;
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return x1 > node.x + 1 && x0 < node.x + node.w - 1 && y1 > node.y + 1 && y0 < node.y + node.h - 1;
}

function segments(edge: ChartEdge) {
  return edge.points.slice(1).map((point, i) => [edge.points[i] ?? point, point] as const);
}

describe.each([
  ["the default measure", undefined],
  ["a measure twice as wide", wide],
] as const)("layout (U-92) with %s", (_, measure) => {
  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: every node placed once, inside the chart",
    (_n, c) => {
      const chart = lay(c, measure);
      const nodes = byId(chart);
      expect(nodes.size).toBe(chart.nodes.length);
      expect(chart.nodes[0]?.role).toBe("start");
      expect(chart.nodes.at(-1)?.role).toBe("end");
      for (const stmt of allStmts(bodyOf(c))) {
        const shape = getNode(keyOf(stmt)).chart;
        const ids =
          shape && "counted" in shape
            ? ["init", "check", "step"].map((r) => `${stmt.id}:${r}`)
            : [stmt.id];
        for (const id of ids) expect(nodes.get(id)?.owner, id).toBe(stmt.id);
      }
      for (const node of chart.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x + node.w).toBeLessThanOrEqual(chart.width);
        expect(node.y + node.h).toBeLessThanOrEqual(chart.height);
      }
      for (const edge of chart.edges) {
        for (const point of [...edge.points, edge.anchor]) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(chart.width);
          expect(point.y).toBeLessThanOrEqual(chart.height);
        }
      }
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))("%s: no two nodes overlap", (_n, c) => {
    const drawn = lay(c, measure).nodes.filter((node) => node.w > 0);
    for (const [i, a] of drawn.entries()) {
      for (const b of drawn.slice(i + 1))
        expect(rectsOverlap(a, b, 4), `${a.id} / ${b.id}`).toBe(false);
    }
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: edges are orthogonal, join their nodes, and cross no other node",
    (_n, c) => {
      const chart = lay(c, measure);
      const nodes = byId(chart);
      expect(new Set(chart.edges.map((edge) => edge.id)).size).toBe(chart.edges.length);
      for (const edge of chart.edges) {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        expect(from && to, edge.id).toBeTruthy();
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        for (const [a, b] of segments(edge)) {
          expect(a.x === b.x || a.y === b.y, edge.id).toBe(true);
          for (const node of chart.nodes) {
            if (node.id !== edge.from && node.id !== edge.to) {
              expect(crosses(a, b, node), `${edge.id} through ${node.id}`).toBe(false);
            }
          }
        }
        for (const node of chart.nodes) {
          expect(crosses(edge.anchor, edge.anchor, node), `anchor of ${edge.id}`).toBe(false);
        }
        const [first, final] = [edge.points[0], edge.points.at(-1)];
        if (from && first) expect(onBorder(first, from), `${edge.id} leaves ${from.id}`).toBe(true);
        if (to && final) expect(onBorder(final, to), `${edge.id} reaches ${to.id}`).toBe(true);
      }
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: every node is reached from Start",
    (_n, c) => {
      const chart = lay(c, measure);
      const reached = new Set(["start"]);
      for (let grew = true; grew;) {
        grew = false;
        for (const edge of chart.edges) {
          if (reached.has(edge.from) && !reached.has(edge.to)) {
            reached.add(edge.to);
            grew = true;
          }
        }
      }
      const dead = new Set(["returns in a loop in an if"]); // the statements after a loop that always returns
      if (!dead.has(c.name))
        expect(chart.nodes.filter((node) => !reached.has(node.id))).toEqual([]);
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))("%s: branches and loops match U-33", (_n, c) => {
    const chart = lay(c, measure);
    const nodes = byId(chart);
    const out = (id: string, label: "yes" | "no") =>
      chart.edges.filter((edge) => edge.from === id && edge.label === label);
    for (const stmt of allStmts(bodyOf(c))) {
      const shape = getNode(keyOf(stmt)).chart;
      if (!shape || "jump" in shape) {
        expect(nodes.get(stmt.id)?.shape).toBe("box");
        continue;
      }
      const inside = regionsOf(stmt).flatMap((region) => [...allStmts(region.stmts)]);
      const under = chart.nodes.filter(
        (node) => node.owner !== null && inside.some((s) => s.id === node.owner),
      );
      if ("branch" in shape) {
        const d = nodes.get(stmt.id);
        const [yes] = out(stmt.id, "yes");
        const [no] = out(stmt.id, "no");
        if (!d || !yes || !no) throw new Error(`branch ${stmt.id}`);
        expect(d.shape).toBe("diamond");
        expect(yes.points[0]).toEqual({ x: d.x + d.w, y: d.y + d.h / 2 }); // Yes leaves by the right vertex
        expect(no.points[0]).toEqual({ x: centre(d), y: d.y + d.h }); // No by the bottom vertex
        const yesTo = nodes.get(yes.to);
        const noTo = nodes.get(no.to);
        if (yesTo?.role !== "merge") expect(centre(yesTo ?? d)).toBeGreaterThan(d.x + d.w);
        if (noTo?.role !== "merge") expect(centre(noTo ?? d)).toBe(centre(d));
        const merge = nodes.get(`${stmt.id}:merge`);
        if (merge) {
          expect(centre(merge)).toBe(centre(d));
          for (const node of under) expect(node.y + node.h).toBeLessThan(merge.y);
          const bare =
            regionsOf(stmt).find((region) => region.slot === shape.branch.no)?.stmts.length === 0;
          if (bare)
            expect(no).toMatchObject({
              to: merge.id,
              points: [no.points[0], { x: centre(d), y: merge.y }],
            });
        }
        continue;
      }
      const counted = "counted" in shape;
      const d = nodes.get(counted ? `${stmt.id}:check` : stmt.id);
      const junction = nodes.get(`${stmt.id}:junction`);
      if (!d || !junction) throw new Error(`loop ${stmt.id}`);
      expect(d.shape).toBe("diamond");
      expect(centre(junction)).toBe(centre(d));
      expect(junction.y).toBeLessThan(d.y);
      const [yes] = out(d.id, "yes");
      const [no] = out(d.id, "no");
      if (!yes || !no) throw new Error(`loop ${stmt.id} edges`);
      expect(yes.points[0]).toEqual({ x: centre(d), y: d.y + d.h }); // Yes leads down into the body
      expect(no.points[0]).toEqual({ x: d.x + d.w, y: d.y + d.h / 2 }); // No leaves to the right
      const bottom = Math.max(d.y + d.h, ...under.map((node) => node.y + node.h));
      expect(Math.max(...no.points.map((point) => point.y))).toBeGreaterThan(bottom);
      const backs = chart.edges.filter((edge) => edge.to === junction.id && edge.back);
      expect(backs.length).toBeLessThanOrEqual(1);
      for (const back of backs) {
        const lane = Math.min(...back.points.map((point) => point.x));
        for (const node of [d, ...under]) expect(lane).toBeLessThan(node.x);
        expect(back.points.at(-1)).toEqual({ x: centre(junction), y: junction.y });
      }
      if (counted) {
        const init = nodes.get(`${stmt.id}:init`);
        const step = nodes.get(`${stmt.id}:step`);
        if (!init || !step) throw new Error(`counted ${stmt.id}`);
        expect([init.generated, d.generated, step.generated]).toEqual([true, true, true]);
        expect([centre(init), centre(step)]).toEqual([centre(d), centre(d)]);
        expect(init.y + init.h).toBeLessThan(junction.y);
        for (const node of under) expect(node.y + node.h).toBeLessThan(step.y);
        expect(backs.map((edge) => edge.from)).toEqual([step.id]);
      }
      const next = nodes.get(`${stmt.id}:next`);
      if (next) expect(backs.map((edge) => edge.from)).toEqual([next.id]);
    }
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: each region offers the places 0..n once (U-34)",
    (_n, c) => {
      const chart = lay(c, measure);
      const count = new Map<string, number>();
      for (const edge of chart.edges) {
        if (!edge.place) continue;
        const key = `${edge.place.parent}/${edge.place.slot}/${edge.place.index}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
      const expectRegion = (parent: string, slot: string, stmts: Stmt[]) => {
        for (let index = 0; index <= stmts.length; index += 1) {
          // A Return's edge to End carries the place after it; after a branch whose regions all
          // return nothing flows on, so no edge is there to carry one.
          const before = stmts[index - 1];
          const offered = before === undefined || flows(before) || leaves(before);
          expect(count.get(`${parent}/${slot}/${index}`), `${parent}/${slot}/${index}`).toBe(
            offered ? 1 : undefined,
          );
        }
      };
      expectRegion(c.chart ?? "main", c.chart ? "body" : "main", bodyOf(c));
      for (const stmt of allStmts(bodyOf(c))) {
        for (const region of regionsOf(stmt)) expectRegion(stmt.id, region.slot, region.stmts);
      }
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))("%s: deterministic", (_n, c) => {
    expect(lay(c, measure)).toEqual(lay({ ...c, program: structuredClone(c.program) }, measure));
  });
});

function onBorder(point: { x: number; y: number }, node: ChartNode): boolean {
  if (node.w === 0) return point.x === node.x && point.y === node.y;
  const onX = point.x === node.x || point.x === node.x + node.w;
  const onY = point.y === node.y || point.y === node.y + node.h;
  const inX = point.x >= node.x && point.x <= node.x + node.w;
  const inY = point.y >= node.y && point.y <= node.y + node.h;
  return (onX && inY) || (onY && inX);
}

describe("layout of jumps (U-33, N-09)", () => {
  const jumpsOf = (chart: ChartLayout, id: string) =>
    chart.edges.filter((edge) => edge.from === id);

  it("U-33: in a for, break leads past the loop and continue to its step", () => {
    const stop = brk();
    const skip = cont();
    const loop = for_("i", num(0), num(9), [if_(lt("i", 2), [skip], [stop])]);
    const after = print(str("after"));
    const chart = layout(program([loop, after]));
    expect(jumpsOf(chart, stop.id).map((edge) => edge.to)).toEqual([`${loop.id}:exit`]);
    expect(jumpsOf(chart, skip.id).map((edge) => edge.to)).toEqual([`${loop.id}:step`]);
    const no = chart.edges.find((edge) => edge.from === `${loop.id}:check` && edge.label === "no");
    expect(no?.to).toBe(`${loop.id}:exit`);
    expect(jumpsOf(chart, `${loop.id}:exit`)).toMatchObject([
      { to: after.id, place: { parent: "main", slot: "main", index: 1 } },
    ]);
  });

  it("U-33: in a while, continue meets the back edge and break leads past the loop", () => {
    const stop = brk();
    const skip = cont();
    const loop = while_(lt("i", 9), [if_(lt("i", 2), [skip]), stop]);
    const chart = layout(program([assign("i", num(0)), loop]));
    expect(jumpsOf(chart, skip.id).map((edge) => edge.to)).toEqual([`${loop.id}:next`]);
    expect(jumpsOf(chart, stop.id)).toMatchObject([
      { to: `${loop.id}:exit`, place: { parent: loop.id, slot: "body", index: 2 } },
    ]);
    const back = chart.edges.find((edge) => edge.back);
    expect(back).toMatchObject({ from: `${loop.id}:next`, to: `${loop.id}:junction` });
  });

  it("U-33: a jump outside every loop is an ordinary box with an edge to the next node", () => {
    const stop = brk();
    const chart = layout(program([stop, print(num(1))]));
    expect(jumpsOf(chart, stop.id)).toHaveLength(1);
    expect(jumpsOf(chart, stop.id)[0]?.jump).toBeUndefined();
  });
});

describe("layout (U-31, U-33 texts)", () => {
  it("main: Start, one Input node per input with the chosen values, the statements, End", () => {
    const sum = CHALLENGES.find((challenge) => challenge.id === "sum-to-n");
    if (!sum) throw new Error("sum-to-n missing");
    const chart = layout(sum.solution, { inputs: { n: 0 } });
    expect(chart.nodes.slice(0, 2).map((node) => node.text)).toEqual(["Start", "Input n = 0"]);
    expect(layout(sum.solution).nodes[1]?.text).toBe("Input n = 10");
    expect(chart.nodes.at(-1)?.text).toBe("End");
    const texts = chart.nodes.filter((node) => node.generated).map((node) => node.text);
    expect(texts).toEqual(["Set i to 1", "i < n + 1?", "Set i to i + 1"]);
  });

  it("a diamond asks its condition; a function chart starts with its signature and has no inputs", () => {
    const check = if_(bin("==", bin("%", v("x"), num(15)), num(0)), [ret(v("x"))]);
    const f = fn("f", [check, ret(num(0))]);
    const chart = layout(program([], { functions: [f], inputs: [{ name: "n", value: 1 }] }), {
      chart: f.id,
    });
    expect(chart.nodes[0]?.text).toBe("Start f(x)");
    expect(chart.nodes.some((node) => node.role === "input")).toBe(false);
    expect(chart.nodes.find((node) => node.id === check.id)?.text).toBe(
      "(remainder of x divided by 15) = 0?",
    );
    const jumps = chart.edges.filter((edge) => edge.jump);
    expect(jumps.map((edge) => edge.to)).toEqual(["end", "end"]); // U-31: a Return leads to End
  });

  it("U-95: a named node shows its name alone, with its sentence as the title", () => {
    const named = { ...print(v("x")), name: "Show x" };
    const unfinished = { ...print(ast.empty()), name: "Show y" };
    const loop = { ...for_("i", num(0), num(3), []), name: "Three times" };
    const check = { ...if_(bin("<", v("x"), num(2)), []), name: "Small?" };
    const chart = layout(program([assign("x", num(1)), named, unfinished, loop, check]));
    const node = (id: string) => chart.nodes.find((n) => n.id === id);
    expect(node(named.id)).toMatchObject({ text: "Show x", title: "Print x" });
    expect(node(unfinished.id)).toMatchObject({ text: "Print choose a value" });
    expect(node(unfinished.id)?.title).toBeUndefined();
    expect(node(`${loop.id}:check`)).toMatchObject({ text: "Three times" });
    expect(node(`${loop.id}:init`)?.text).toBe("Set i to 0");
    const startless = { ...for_("k", ast.empty(), num(3), []), name: "Counting" };
    const unfinishedLoop = layout(program([startless]));
    expect(unfinishedLoop.nodes.find((n) => n.id === `${startless.id}:check`)?.text).toBe("k < 3?");
    expect(node(check.id)).toMatchObject({ text: "Small?", title: "If x < 2" });
  });

  it("U-33: a long diamond's text is drawn on two lines, split at a space between words", () => {
    const measure: Measure = (text) => text.length * 7;
    const check = if_(bin("==", bin("%", v("i"), num(15)), num(0)), []);
    const short = if_(bin("<", v("i"), num(2)), []);
    const chart = layout(program([assign("i", num(1)), check, short]), { measure });
    const lines = (id: string) => {
      const parts = chart.nodes.find((n) => n.id === id)?.parts ?? [];
      return [-LINE / 2, LINE / 2].map((dy) =>
        parts
          .filter((part) => part.dy === dy)
          .map((part) => part.text)
          .join("")
          .trimEnd(),
      );
    };
    expect(chart.nodes.find((n) => n.id === check.id)?.text).toBe(
      "(remainder of i divided by 15) = 0?",
    );
    expect(lines(check.id)).toEqual(["(remainder of i", "divided by 15) = 0?"]);
    const one = chart.nodes.find((n) => n.id === short.id)?.parts ?? [];
    expect(new Set(one.map((part) => part.dy))).toEqual(new Set([0]));
  });

  it("N-08: a variable's run is measured bold", () => {
    const measure: Measure = (text, _shape, bold) => text.length * (bold ? 10 : 5);
    const shown = print(v("abc"));
    const chart = layout(program([shown]), { measure });
    const parts = chart.nodes.find((n) => n.id === shown.id)?.parts ?? [];
    expect(parts.map((part) => [part.text, part.w, part.variable])).toEqual([
      ["Print ", 30, undefined],
      ["abc", 30, true],
    ]);
  });

  it("an empty main offers its one connector between Start and End (U-34)", () => {
    const chart = layout(program([]));
    expect(chart.edges).toHaveLength(1);
    expect(chart.edges[0]).toMatchObject({
      from: "start",
      to: "end",
      place: { parent: "main", slot: "main", index: 0 },
    });
  });
});
