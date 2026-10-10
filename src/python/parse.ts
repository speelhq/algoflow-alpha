// Typed expression text → Expr. No third-party imports.
import { newId } from "@/lang/id";
import type { BinOp, Expr, Id } from "@/lang/types";
import { NODES, hasNode, keyOf } from "@/nodes/registry";
import { BINOPS, PRECEDENCE, binopsAt, isBinOp, isComparison } from "./precedence";

export type ParseScope = { classes: Id[]; functions: Id[] };
export const PARSE_CODES = ["E_PARSE_SYNTAX", "E_PARSE_CHAIN", "E_UNKNOWN_CALL"] as const;
export type ParseError = {
  code: (typeof PARSE_CODES)[number];
  position: number;
  params?: Record<string, string>;
};

export function isParseError(result: Expr | ParseError): result is ParseError {
  return "code" in result;
}

// ---------------------------------------------------------------- tokens

type Token = {
  type: "num" | "str" | "name" | "op" | "end";
  text: string;
  value: string;
  pos: number;
};

const NUMBER = /^(?:\d+\.\d*(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\.\d+(?:[eE][+-]?\d+)?|\d+)/;
const LEADING_ZERO = /^0+\d*[1-9]/; // Python rejects `0777`; `0` and `00` are fine
const NAME = /^[A-Za-z_][A-Za-z0-9_]*/;
const SYMBOL_OPS = BINOPS.filter((op) => !/^[a-z]/.test(op));
const OPS2 = SYMBOL_OPS.filter((op) => op.length === 2);
const OPS1 = `${SYMBOL_OPS.filter((op) => op.length === 1).join("")}()[]{},:.`;
const WORD_OPS = new Set(BINOPS.filter((op) => /^[a-z]/.test(op)));
const KEYWORDS = new Set([...WORD_OPS, "not", "True", "False", "None"]);
const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "\\": "\\",
  '"': '"',
  "'": "'",
};

class Fail {
  constructor(readonly error: ParseError) {}
}

function fail(code: ParseError["code"], position: number, params?: Record<string, string>): never {
  throw new Fail(params ? { code, position, params } : { code, position });
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < text.length) {
    const ch = text[pos] ?? "";
    if (/\s/.test(ch)) {
      pos += 1;
      continue;
    }
    const rest = text.slice(pos);
    const num = NUMBER.exec(rest);
    if (num) {
      const [raw] = num;
      if (!/[.eE]/.test(raw) && LEADING_ZERO.test(raw)) fail("E_PARSE_SYNTAX", pos);
      tokens.push({ type: "num", text: raw, value: raw, pos });
      pos += raw.length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let value = "";
      let i = pos + 1;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === "\\") {
          const next = text[i + 1] ?? "";
          if (next === "x" && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 2, i + 4))) {
            value += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 4), 16));
            i += 4;
            continue;
          }
          value += ESCAPES[next] ?? `\\${next}`;
          i += 2;
        } else {
          value += text[i];
          i += 1;
        }
      }
      if (i >= text.length) fail("E_PARSE_SYNTAX", pos);
      tokens.push({ type: "str", text: text.slice(pos, i + 1), value, pos });
      pos = i + 1;
      continue;
    }
    const name = NAME.exec(rest);
    if (name) {
      tokens.push({ type: "name", text: name[0], value: name[0], pos });
      pos += name[0].length;
      continue;
    }
    const op2 = OPS2.find((op) => rest.startsWith(op));
    if (op2) {
      tokens.push({ type: "op", text: op2, value: op2, pos });
      pos += 2;
      continue;
    }
    if (OPS1.includes(ch)) {
      tokens.push({ type: "op", text: ch, value: ch, pos });
      pos += 1;
      continue;
    }
    fail("E_PARSE_SYNTAX", pos);
  }
  tokens.push({ type: "end", text: "", value: "", pos: text.length });
  return tokens;
}

// ---------------------------------------------------------------- aliases

function aliasTable(): Map<string, string> {
  const table = new Map<string, string>();
  for (const def of NODES.values()) {
    if (!def.key.startsWith("call:")) continue;
    for (const alias of def.aliases ?? []) table.set(alias, def.key.slice("call:".length));
  }
  return table;
}

// ---------------------------------------------------------------- parser

class Parser {
  private i = 0;
  private readonly aliases = aliasTable();

  constructor(
    private readonly tokens: Token[],
    private readonly scope: ParseScope,
  ) {}

  private peek(): Token {
    return this.tokens[this.i] ?? { type: "end", text: "", value: "", pos: 0 };
  }

  private take(): Token {
    const token = this.peek();
    this.i += 1;
    return token;
  }

  private isOp(text: string): boolean {
    const token = this.peek();
    return token.type === "op" && token.text === text;
  }

  private isWord(text: string): boolean {
    const token = this.peek();
    return token.type === "name" && token.text === text;
  }

  /** The next token as a binary operator of the given level, if it is one. */
  private binopAt(level: number): BinOp | undefined {
    const token = this.peek();
    if (token.type !== "op" && token.type !== "name") return undefined;
    if (!isBinOp(token.text)) return undefined;
    return binopsAt(level).includes(token.text) ? token.text : undefined;
  }

  private expectOp(text: string): void {
    if (!this.isOp(text)) fail("E_PARSE_SYNTAX", this.peek().pos);
    this.i += 1;
  }

  /** Every node must have a registered block; the registry is the arbiter of the language. */
  private node(pos: number, expr: Expr): Expr {
    if (!hasNode(keyOf(expr))) fail("E_PARSE_SYNTAX", pos);
    return expr;
  }

  parseAll(): Expr {
    const expr = this.or();
    if (this.peek().type !== "end") fail("E_PARSE_SYNTAX", this.peek().pos);
    return expr;
  }

  private binary(next: () => Expr, level: number): Expr {
    let left = next();
    for (let op = this.binopAt(level); op !== undefined; op = this.binopAt(level)) {
      const pos = this.take().pos;
      const right = next();
      left = this.node(pos, { id: newId(), kind: "binop", op, left, right });
    }
    return left;
  }

  private or(): Expr {
    return this.binary(() => this.and(), PRECEDENCE.or);
  }

  private and(): Expr {
    return this.binary(() => this.not(), PRECEDENCE.and);
  }

  private not(): Expr {
    if (this.isWord("not")) {
      const pos = this.take().pos;
      return this.node(pos, { id: newId(), kind: "unop", op: "not", operand: this.not() });
    }
    return this.cmp();
  }

  private cmp(): Expr {
    const left = this.arith();
    const op = this.binopAt(PRECEDENCE.compare);
    if (op === undefined) return left;
    const pos = this.take().pos;
    const right = this.arith();
    if (this.binopAt(PRECEDENCE.compare) !== undefined) fail("E_PARSE_CHAIN", this.peek().pos);
    return this.node(pos, { id: newId(), kind: "binop", op, left, right });
  }

  private arith(): Expr {
    return this.binary(() => this.term(), PRECEDENCE.additive);
  }

  private term(): Expr {
    return this.binary(() => this.factor(), PRECEDENCE.multiplicative);
  }

  private factor(): Expr {
    if (this.isOp("-")) {
      const pos = this.take().pos;
      return this.node(pos, { id: newId(), kind: "unop", op: "neg", operand: this.factor() });
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.postfix();
    const op = this.binopAt(PRECEDENCE.power);
    if (op !== undefined) {
      const pos = this.take().pos;
      return this.node(pos, { id: newId(), kind: "binop", op, left: base, right: this.factor() });
    }
    return base;
  }

  private args(close: string): Expr[] {
    const items: Expr[] = [];
    if (this.isOp(close)) {
      this.take();
      return items;
    }
    for (;;) {
      items.push(this.or());
      if (this.isOp(",")) {
        this.take();
        continue;
      }
      this.expectOp(close);
      return items;
    }
  }

  private postfix(): Expr {
    let expr = this.atom();
    for (;;) {
      if (this.isOp("[")) {
        const pos = this.take().pos;
        const index = this.or();
        this.expectOp("]");
        expr = this.node(pos, { id: newId(), kind: "index", list: expr, index });
      } else if (this.isOp(".")) {
        this.take();
        const name = this.take();
        if (name.type !== "name") fail("E_PARSE_SYNTAX", name.pos);
        if (this.isOp("(")) {
          this.take();
          const args = this.args(")");
          expr = this.resolveMethod(expr, name, args);
        } else {
          expr = this.node(name.pos, { id: newId(), kind: "field", obj: expr, field: name.text });
        }
      } else if (this.isOp("(")) {
        const open = this.take();
        if (expr.kind !== "var") fail("E_PARSE_SYNTAX", open.pos);
        const args = this.args(")");
        expr = this.resolveCall(expr.name, open.pos - expr.name.length, args);
      } else {
        return expr;
      }
    }
  }

  private resolveCall(name: string, position: number, args: Expr[]): Expr {
    if (this.scope.classes.includes(name)) {
      return this.node(position, { id: newId(), kind: "new", cls: name, args });
    }
    if (hasNode(`call:${name}`)) return { id: newId(), kind: "call", fn: name, args };
    if (this.scope.functions.includes(name)) {
      return this.node(position, { id: newId(), kind: "call", fn: name, args });
    }
    return fail("E_UNKNOWN_CALL", position, { name });
  }

  /** Builtin aliases and method calls. */
  private resolveMethod(obj: Expr, name: Token, args: Expr[]): Expr {
    if (obj.kind === "var") {
      const fn = this.aliases.get(`${obj.name}.${name.text}`);
      if (fn) return { id: newId(), kind: "call", fn, args };
    }
    if (hasNode(`method:${name.text}`)) {
      return { id: newId(), kind: "method", obj, name: name.text, args };
    }
    return fail("E_UNKNOWN_CALL", name.pos, { name: name.text });
  }

  private atom(): Expr {
    const token = this.take();
    switch (token.type) {
      case "num":
        return {
          id: newId(),
          kind: "num",
          value: Number(token.text),
          float: /[.eE]/.test(token.text),
          raw: token.text,
        };
      case "str":
        return { id: newId(), kind: "str", value: token.value };
      case "name":
        if (token.text === "True" || token.text === "False") {
          return { id: newId(), kind: "bool", value: token.text === "True" };
        }
        if (token.text === "None") return { id: newId(), kind: "none" };
        if (KEYWORDS.has(token.text)) return fail("E_PARSE_SYNTAX", token.pos);
        return { id: newId(), kind: "var", name: token.text };
      case "op":
        if (token.text === "(") {
          const inner = this.or();
          this.expectOp(")");
          return inner;
        }
        if (token.text === "[") {
          return this.node(token.pos, { id: newId(), kind: "list", items: this.args("]") });
        }
        if (token.text === "{") return this.dict(token.pos);
        return fail("E_PARSE_SYNTAX", token.pos);
      case "end":
        return fail("E_PARSE_SYNTAX", token.pos);
    }
  }

  private dict(pos: number): Expr {
    const entries: Array<{ key: Expr; value: Expr }> = [];
    if (this.isOp("}")) {
      this.take();
      return this.node(pos, { id: newId(), kind: "dict", entries });
    }
    for (;;) {
      const key = this.or();
      this.expectOp(":");
      const value = this.or();
      entries.push({ key, value });
      if (this.isOp(",")) {
        this.take();
        continue;
      }
      this.expectOp("}");
      return this.node(pos, { id: newId(), kind: "dict", entries });
    }
  }
}

export function parse(
  text: string,
  scope: ParseScope = { classes: [], functions: [] },
): Expr | ParseError {
  try {
    return new Parser(tokenize(text), scope).parseAll();
  } catch (error) {
    if (error instanceof Fail) return error.error;
    throw error;
  }
}

export { isComparison };
