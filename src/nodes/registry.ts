// The only registry. Interpreter, emitter, parser, validator, palette,
// and properties all dispatch through `getNode(keyOf(node))`.
import type { Node } from "@/lang/types";
import { assign } from "./assign";
import { binop } from "./binop";
import { bool } from "./bool";
import { breakStmt } from "./break";
import { call } from "./call";
import { abs } from "./call-abs";
import { floatCall } from "./call-float";
import { intCall } from "./call-int";
import { max } from "./call-max";
import { min } from "./call-min";
import { randomInt } from "./call-random_int";
import { strCall } from "./call-str";
import type { Category } from "./categories";
import { continueStmt } from "./continue";
import { empty } from "./empty";
import { exprStmt } from "./expr";
import { forStmt } from "./for";
import { ifStmt } from "./if";
import { none } from "./none";
import { num } from "./num";
import { print } from "./print";
import { returnStmt } from "./return";
import { str } from "./str";
import type { NodeDef } from "./types";
import { unop } from "./unop";
import { variable } from "./var";
import { whileStmt } from "./while";

const ALL: NodeDef[] = [
  // statements
  assign,
  ifStmt,
  forStmt,
  whileStmt,
  breakStmt,
  continueStmt,
  print,
  exprStmt,
  returnStmt,
  // expressions, in the order of the value list's entries
  empty,
  num,
  variable,
  str,
  bool,
  none,
  unop,
  randomInt,
  binop,
  abs,
  max,
  min,
  strCall,
  intCall,
  floatCall,
  call,
];

export const NODES: ReadonlyMap<string, NodeDef> = new Map(ALL.map((def) => [def.key, def]));

export function hasNode(key: string): boolean {
  return NODES.has(key);
}

export function getNode(key: string): NodeDef {
  const def = NODES.get(key);
  if (!def) throw new Error(`unknown node "${key}"`);
  return def;
}

/** Registry key of an AST node: its kind, or `call:<fn>` / `method:<name>` for builtins. */
export function keyOf(node: Node): string {
  if (node.kind === "call") return NODES.has(`call:${node.fn}`) ? `call:${node.fn}` : "call";
  if (node.kind === "method") return `method:${node.name}`;
  return node.kind;
}

/** Block menu entries of one category, in registration order. */
export function paletteNodes(category: Category): NodeDef[] {
  return ALL.filter((def) => def.category === category && !def.hidden);
}

export type { EmitContext, NodeDef, PyLine, RunContext, Signal, Slot } from "./types";
