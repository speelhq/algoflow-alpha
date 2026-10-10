// Import validates and migrates by `version`. Only version 1 exists; the
// check is structural (shape, known kinds, ids); semantics are validate()'s job.
import { getNode, hasNode, keyOf } from "@/nodes/registry";
import { isNodeId } from "./id";
import type { Expr, Program, Stmt, Target } from "./types";
import { isRecord } from "./record";
import { regionsOf, targetExprs } from "./walk";

export class MigrateError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "MigrateError";
  }
}

export const CURRENT_VERSION = 1;

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new MigrateError(path, "expected an array");
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new MigrateError(path, "expected a string");
  return value;
}

function expectNodeId(value: unknown, path: string): void {
  if (!isNodeId(value)) throw new MigrateError(path, "expected a 12-character node id");
}

/** The raw slot values of a node, by the registry's slot roles (no `isExpr` filtering). */
function rawChildren(
  node: Record<string, unknown>,
  path: string,
): Array<{ value: unknown; path: string }> {
  const out: Array<{ value: unknown; path: string }> = [];
  for (const slot of getNode(keyOf(node as unknown as Expr)).slots) {
    const value = node[slot.name];
    if (slot.role === "expr") {
      if (value !== undefined) out.push({ value, path: `${path}.${slot.name}` });
    } else if (slot.role === "exprs") {
      expectArray(value, `${path}.${slot.name}`).forEach((item, i) =>
        out.push({ value: item, path: `${path}.${slot.name}[${i}]` }),
      );
    } else if (slot.role === "target") {
      if (!isRecord(value) || typeof value.kind !== "string") {
        throw new MigrateError(`${path}.${slot.name}`, "expected a target");
      }
      targetExprs(value as unknown as Target).forEach((item, i) =>
        out.push({ value: item, path: `${path}.${slot.name}[${i}]` }),
      );
    }
  }
  return out;
}

function checkExpr(value: unknown, path: string): void {
  if (!isRecord(value)) throw new MigrateError(path, "expected an expression");
  expectNodeId(value.id, `${path}.id`);
  const kind = expectString(value.kind, `${path}.kind`);
  if (!hasNode(keyOf(value as unknown as Expr))) {
    throw new MigrateError(`${path}.kind`, `unknown kind "${kind}"`);
  }
  for (const child of rawChildren(value, path)) checkExpr(child.value, child.path);
}

/** The kind of a statement no block reads any more; loading drops it. */
const DROPPED = "comment";

function checkStmts(value: unknown, path: string): void {
  const stmts = expectArray(value, path);
  stmts.forEach((stmt, i) => {
    const at = `${path}[${i}]`;
    if (!isRecord(stmt)) throw new MigrateError(at, "expected a statement");
    expectNodeId(stmt.id, `${at}.id`);
    const kind = expectString(stmt.kind, `${at}.kind`);
    if (kind === DROPPED) return;
    if ("name" in stmt) {
      if (typeof stmt.name !== "string" || /[\n\r]/.test(stmt.name)) {
        throw new MigrateError(`${at}.name`, "expected one line of text");
      }
      // A name is stored trimmed, and absent when empty.
      const name = stmt.name.trim();
      if (name === "") delete stmt.name;
      else stmt.name = name;
    }
    if (!hasNode(kind) || getNode(kind).shape !== "stmt") {
      throw new MigrateError(`${at}.kind`, `unknown kind "${kind}"`);
    }
    for (const child of rawChildren(stmt, at)) checkExpr(child.value, child.path);
    for (const region of regionsOf(stmt as unknown as Stmt)) {
      checkStmts(region.stmts, `${at}.${region.slot}`);
    }
  });
  const kept = stmts.filter((stmt) => !isRecord(stmt) || stmt.kind !== DROPPED);
  stmts.splice(0, stmts.length, ...kept);
}

function checkV1(json: Record<string, unknown>): Program {
  expectString(json.title, "title");
  expectArray(json.inputs, "inputs").forEach((input, i) => {
    if (!isRecord(input) || typeof input.name !== "string" || !("value" in input)) {
      throw new MigrateError(`inputs[${i}]`, "expected { name, value }");
    }
  });
  expectArray(json.classes, "classes").forEach((cls, i) => {
    if (!isRecord(cls) || typeof cls.name !== "string" || !Array.isArray(cls.fields)) {
      throw new MigrateError(`classes[${i}]`, "expected { id, name, fields }");
    }
    expectNodeId(cls.id, `classes[${i}].id`);
    cls.fields.forEach((field, j) => {
      if (!isRecord(field) || typeof field.name !== "string" || !("default" in field)) {
        throw new MigrateError(`classes[${i}].fields[${j}]`, "expected { name, default }");
      }
    });
  });
  expectArray(json.functions, "functions").forEach((fn, i) => {
    if (!isRecord(fn) || typeof fn.name !== "string" || !Array.isArray(fn.params)) {
      throw new MigrateError(`functions[${i}]`, "expected { id, name, params, body }");
    }
    expectNodeId(fn.id, `functions[${i}].id`);
    fn.params.forEach((param, j) => expectString(param, `functions[${i}].params[${j}]`));
    checkStmts(fn.body, `functions[${i}].body`);
  });
  checkStmts(json.main, "main");
  return json as unknown as Program;
}

export function migrate(json: unknown): Program {
  if (!isRecord(json)) throw new MigrateError("", "expected a program object");
  const version = json.version;
  if (version !== CURRENT_VERSION) {
    throw new MigrateError("version", `unsupported version ${String(version)}`);
  }
  return checkV1(json);
}
