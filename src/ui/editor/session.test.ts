// The slot clicked, else the first to fill, takes the keyboard; keys in a value line, Tab past its last field, `,` in a list; a handler's changes chain on what each returns.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast, program } from "@/nodes/testing";
import { fieldsOf, startField, type Field } from "./fields";
import type { LineContext } from "./line";
import {
  commit,
  focusField,
  follow,
  openSession,
  settleWord,
  stepHighlight,
  chain,
  valueKey,
  type Session,
  type Step,
} from "./session";

const { assign, print, num, bin, v, empty } = ast;

const ctx: LineContext = {
  variables: ["x", "total"],
  kinds: new Map<string, Kind>([["x", "number"]]),
  scope: { functions: [] },
  functions: [],
};

/** Each key of `keys` pressed in turn, every press on the session the one before left. */
const press = (session: Session, keys: string): Step => {
  let step: Step = { session, edits: [] };
  for (const key of keys) {
    step = chain(step, (s) => valueKey(s, { key, shiftKey: false }, [], ctx));
  }
  return step;
};

describe("editor session", () => {
  it("the slot clicked takes the keyboard, else the first field still to fill", () => {
    const hole = empty();
    const stmt = assign("total", bin("+", v("x"), hole));
    const fields = fieldsOf(stmt, program([stmt]));
    expect(fields).toEqual([
      { slot: "target", role: "target" },
      { slot: "value", role: "expr" },
    ]);
    expect(startField(stmt, fields, { slot: null, hole: null })).toEqual(fields[1]);
    expect(startField(stmt, fields, { slot: "target", hole: null })).toEqual(fields[0]);
    const opened = openSession(stmt, fields[1] ?? null, hole.id);
    expect(opened.line?.caret).toEqual({ at: hole.id });
  });

  it("a value typed is written once, when it changes the field's value", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const typed = press(openSession(stmt, field, null), "7");
    expect(typed.edits).toHaveLength(1);
    expect(typed.edits[0]).toMatchObject({ field, root: { kind: "num", value: 7 } });
    const line = typed.session.line;
    expect(line && commit(typed.session, line).edits).toEqual([]);
  });

  it("`,` in a list item chooses the word and asks for the next item; the chain reads what it returned", () => {
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const word = press(openSession(stmt, field, null), "x");
    expect(word.edits).toEqual([]);
    const comma = valueKey(word.session, { key: ",", shiftKey: false }, [], ctx);
    expect(comma.after).toEqual({ addItem: 1 });
    expect(comma.edits).toMatchObject([{ field, root: { kind: "var", name: "x" } }]);
    // Leaving the line from the session the key returned writes nothing more; from the session
    // before it, the word would be chosen and written a second time.
    expect(settleWord(comma.session, ctx).edits).toEqual([]);
    expect(settleWord(word.session, ctx).edits).toHaveLength(1);
  });

  it("Tab past the line's last field leaves for the next field; Enter with nothing chosen closes", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value", role: "expr" };
    const session = openSession(stmt, field, null);
    expect(valueKey(session, { key: "Tab", shiftKey: false }, [], ctx).after).toEqual({ go: 1 });
    expect(valueKey(session, { key: "Enter", shiftKey: false }, [], ctx).after).toBe("close");
    expect(valueKey(session, { key: "Escape", shiftKey: false }, [], ctx).taken).toBe(false);
  });

  it("a value changed elsewhere reopens the line; focusing a field opens its value", () => {
    const stmt = assign("total", num(1));
    const field: Field = { slot: "value", role: "expr" };
    const session = openSession(stmt, field, null);
    expect(follow(session, stmt)).toBe(session);
    const undone = assign("total", num(2));
    undone.id = stmt.id;
    expect(follow(session, undone).line?.root).toMatchObject({ kind: "num", value: 2 });
    const target: Field = { slot: "target", role: "target" };
    expect(focusField(session, stmt, target, null)).toMatchObject({ focus: target, line: null });
  });

  it("↓ and ↑ wrap round the list, and `chain` keeps both steps' values in order", () => {
    const session = openSession(print(empty()), null, null);
    expect(stepHighlight(session, 3, null, 1).highlight).toBe(0);
    expect(stepHighlight(session, 3, null, -1).highlight).toBe(2);
    expect(stepHighlight(session, 3, 2, 1).highlight).toBe(0);
    const stmt = print(empty());
    const field: Field = { slot: "args", role: "expr", index: 0 };
    const both = chain(press(openSession(stmt, field, null), "1"), (s) => press(s, "2"));
    expect(both.edits.map((edit) => edit.root)).toMatchObject([{ value: 1 }, { value: 12 }]);
  });
});
