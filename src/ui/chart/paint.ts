// What the chart draws while running, derived from the driver state
// and the layout: the taken path, the ✓ / ✗ marks, the current node, and the breakpoint.
// Chart nodes are matched to statements through `owner` and `role`, never through a kind.
import type { NodeId } from "@/lang/types";
import type { Event } from "@/runtime/types";
import type { ChartLayout, ChartNode } from "./layout";

export type RunView = {
  /** The run finished (`done`): `End` is on the taken path. */
  finished: boolean;
  activeId: NodeId | null;
  lastEvent: Event | null;
  taken: Record<NodeId, true>;
  verdicts: Record<NodeId, boolean>;
  breakpoint: NodeId | null;
};

export type Paint = {
  /** Chart node ids drawn in the taken-path colour. */
  nodes: Set<string>;
  edges: Set<string>;
  /** Diamond chart node id → ✓ (true) or ✗ (false). */
  marks: Map<string, boolean>;
  /** The chart node with the accent outline or the error outline. */
  current: string | null;
  breakpoint: string | null;
};

/** The node that stands for a statement: a counted loop's check, else its own node. */
export function nodeFor(nodes: readonly ChartNode[], owner: NodeId): ChartNode | undefined {
  const own = nodes.filter((node) => node.owner === owner);
  return own.find((node) => node.role === "check") ?? own.find((node) => node.role === "stmt");
}

/** The current node: a counted loop's init on its `enter`, its check on its other events. */
export function currentNode(chart: ChartLayout, view: RunView): string | null {
  if (view.activeId === null) return null;
  const owner = view.activeId;
  const init = chart.nodes.find((node) => node.owner === owner && node.role === "init");
  const entering = view.lastEvent?.type === "enter" && view.lastEvent.nodeId === owner;
  if (init && entering) return init.id;
  return nodeFor(chart.nodes, owner)?.id ?? null;
}

function isTaken(node: ChartNode, view: RunView): boolean {
  if (node.role === "start" || node.role === "input") return true;
  if (node.role === "end") return view.finished;
  return node.owner !== null && node.owner in view.taken;
}

export function paint(chart: ChartLayout, view: RunView): Paint {
  const byId = new Map(chart.nodes.map((node) => [node.id, node]));
  const nodes = new Set(chart.nodes.filter((node) => isTaken(node, view)).map((node) => node.id));
  const edges = new Set<string>();
  for (const edge of chart.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to || !nodes.has(from.id) || !nodes.has(to.id)) continue;
    const verdict = from.owner === null ? undefined : view.verdicts[from.owner];
    // A labelled edge follows its diamond's mark; once a loop's mark is cleared on leaving
    // it (control is elsewhere), its `No` edge is taken when what it leads to is: what follows
    // the loop, or its exit, unless a jump on the path is what reached the exit.
    const left = verdict === undefined && from.owner !== null && from.owner !== view.activeId;
    const jumped = (exit: ChartNode) =>
      chart.edges.some((other) => other.to === exit.id && !other.label && nodes.has(other.from));
    const past = to.owner !== from.owner || (to.role === "exit" && !jumped(to));
    const follows =
      !edge.label || verdict === (edge.label === "yes") || (left && edge.label === "no" && past);
    if (follows) edges.add(edge.id);
  }
  const marks = new Map<string, boolean>();
  for (const [owner, verdict] of Object.entries(view.verdicts)) {
    const node = nodeFor(chart.nodes, owner);
    if (node?.shape === "diamond") marks.set(node.id, verdict);
  }
  const point = view.breakpoint === null ? undefined : nodeFor(chart.nodes, view.breakpoint);
  return { nodes, edges, marks, current: currentNode(chart, view), breakpoint: point?.id ?? null };
}
