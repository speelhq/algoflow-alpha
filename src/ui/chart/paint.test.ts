// U-39, U-60, U-61, U-115: the taken path, marks, current node, and breakpoint drawn while running.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { layout } from "./layout";
import { currentNode, paint, type RunView } from "./paint";

const { bin, for_, if_, num, print, str, v } = ast;

const yes = print(str("zero"));
const branch = if_(bin("==", v("i"), num(0)), [yes], [print(v("i"))]);
const loop = for_("i", num(0), num(3), [branch]);
const after = print(str("done"));
const chart = layout(program([loop, after]), { inputs: {} });

const nodeOf = (owner: string, role: string) =>
  chart.nodes.find((node) => node.owner === owner && node.role === role)?.id;

function view(partial: Partial<RunView>): RunView {
  return {
    ended: false,
    activeId: null,
    lastEvent: null,
    taken: {},
    verdicts: {},
    breakpoint: null,
    ...partial,
  };
}

describe("currentNode (U-115)", () => {
  it("is a counted loop's init on its enter and its check on a pass", () => {
    const enter = view({ activeId: loop.id, lastEvent: { type: "enter", nodeId: loop.id } });
    expect(currentNode(chart, enter)).toBe(nodeOf(loop.id, "init"));
    const pass = view({ activeId: loop.id, lastEvent: { type: "loop", nodeId: loop.id } });
    expect(currentNode(chart, pass)).toBe(nodeOf(loop.id, "check"));
  });

  it("is the statement's own node otherwise, and none before the first step", () => {
    expect(currentNode(chart, view({ activeId: branch.id }))).toBe(branch.id);
    expect(currentNode(chart, view({}))).toBeNull();
  });
});

describe("paint (U-61)", () => {
  it("draws the path of the current pass, a labelled edge by its diamond's mark", () => {
    const p = paint(
      chart,
      view({
        taken: { [loop.id]: true, [branch.id]: true, [yes.id]: true },
        verdicts: { [loop.id]: true, [branch.id]: true },
      }),
    );
    expect(p.nodes.has("start")).toBe(true);
    expect(p.nodes.has(branch.id)).toBe(true);
    expect(p.nodes.has("end")).toBe(false);
    const labelled = chart.edges.filter((edge) => edge.from === branch.id);
    const taken = labelled.filter((edge) => p.edges.has(edge.id)).map((edge) => edge.label);
    expect(taken).toEqual(["yes"]);
    expect(p.marks.get(branch.id)).toBe(true);
    expect(p.marks.get(nodeOf(loop.id, "check") ?? "")).toBe(true);
  });

  it("takes a loop's No edge to the next statement once the loop's mark is cleared", () => {
    const p = paint(
      chart,
      view({ activeId: after.id, taken: { [loop.id]: true, [after.id]: true } }),
    );
    const no = chart.edges.find(
      (edge) => edge.from === nodeOf(loop.id, "check") && edge.label === "no",
    );
    expect(no && p.edges.has(no.id)).toBe(true);
  });

  it("takes a loop's No edge into a following loop's junction once control is there", () => {
    const first = for_("i", num(0), num(2), [print(v("i"))]);
    const second = for_("j", num(0), num(2), [print(v("j"))]);
    const twice = layout(program([first, second]), { inputs: {} });
    const check = twice.nodes.find((node) => node.owner === first.id && node.role === "check");
    const no = twice.edges.find((edge) => edge.from === check?.id && edge.label === "no");
    const at = (activeId: string) =>
      paint(twice, view({ activeId, taken: { [first.id]: true, [second.id]: true } }));
    expect(no && at(second.id).edges.has(no.id)).toBe(true);
    // Before its first check the loop is current and has no mark: its No edge is not taken.
    expect(no && at(first.id).edges.has(no.id)).toBe(false);
  });

  it("U-61: after a loop with a break, the No edge is taken unless the break reached the exit", () => {
    const stop = ast.brk();
    const jumpy = for_("i", num(0), num(3), [if_(bin("==", v("i"), num(1)), [stop])]);
    const next = print(str("done"));
    const drawn = layout(program([jumpy, next]), { inputs: {} });
    const check = drawn.nodes.find((node) => node.owner === jumpy.id && node.role === "check");
    const no = drawn.edges.find((edge) => edge.from === check?.id && edge.label === "no");
    const jump = drawn.edges.find((edge) => edge.from === stop.id);
    const at = (taken: Record<string, true>) => paint(drawn, view({ activeId: next.id, taken }));
    const ended = at({ [jumpy.id]: true, [next.id]: true });
    expect(no && ended.edges.has(no.id)).toBe(true);
    const broke = at({ [jumpy.id]: true, [stop.id]: true, [next.id]: true });
    expect(no && broke.edges.has(no.id)).toBe(false);
    expect(jump && broke.edges.has(jump.id)).toBe(true);
  });

  it("marks the breakpoint on a loop's check and End once the run has ended", () => {
    const p = paint(chart, view({ breakpoint: loop.id, ended: true }));
    expect(p.breakpoint).toBe(nodeOf(loop.id, "check"));
    expect(p.nodes.has("end")).toBe(true);
  });
});
