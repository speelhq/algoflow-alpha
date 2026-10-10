// No third-party imports.
import type { Heap, HeapId, Id, NodeId, Value } from "@/lang/types";

export type Runner = {
  next(): Event | Done;
  state(): State; // call only when paused
  stdout(): string[];
  draws(): number[]; // every random result in order
};

export type Done =
  | { type: "done"; steps: number; loops: number }
  | { type: "error"; error: RuntimeError; steps: number };

export type State = { frames: Frame[]; heap: Heap };
export type Frame = { fn: Id | "main"; callNodeId?: NodeId; vars: Map<Id, Value> };

export const RUNTIME_CODES = [
  "E_UNDEFINED",
  "E_INDEX",
  "E_KEY",
  "E_FIELD",
  "E_TYPE",
  "E_VALUE",
  "E_NUMBER_TEXT",
  "E_EMPTY_RANGE",
  "E_DIV_ZERO",
  "E_POP_EMPTY",
  "E_ARITY",
  "E_RECURSION",
  "E_STEP_LIMIT",
] as const;
export type RuntimeCode = (typeof RUNTIME_CODES)[number];

export type RuntimeError = {
  nodeId: NodeId;
  code: RuntimeCode;
  params: Record<string, string | number>;
};

export type Event =
  | { type: "enter"; nodeId: NodeId }
  | { type: "read"; nodeId: NodeId; refs: Ref[] }
  | { type: "write"; nodeId: NodeId; ref: Ref; value: Value }
  | { type: "swap"; nodeId: NodeId; a: Ref; b: Ref }
  | { type: "compare"; nodeId: NodeId; result: boolean }
  | { type: "loop"; nodeId: NodeId; var?: Id; value?: Value }
  | { type: "call"; nodeId: NodeId; fn: Id; args: Value[] }
  | { type: "return"; nodeId: NodeId; fn: Id; value: Value }
  | { type: "print"; nodeId: NodeId; text: string };

export type Ref =
  | { var: Id }
  | { heap: HeapId; index: number }
  | { heap: HeapId; key: string }
  | { heap: HeapId; field: Id };
