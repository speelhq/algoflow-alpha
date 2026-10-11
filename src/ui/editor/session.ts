// The node editor's editing session: the field that has the keyboard, its value line, the name
// being typed, the list's highlight, whether the list shows every entry, and the operator being
// switched. Every change is a pure transition from one session to the next, returning the values
// it writes, so a handler that makes several changes chains them on what each one returned.
import type { Expr, NodeId, Stmt } from "@/lang/types";
import { sameField, valueOf, type Field } from "./fields";
import {
  backspace,
  choose,
  clickAt,
  endText,
  move,
  openLine,
  settle,
  switchTo,
  tab,
  type,
  type Line,
  type LineContext,
  type Row,
} from "./line";

export type Session = {
  focus: Field | null;
  line: Line | null;
  typed: string | null;
  highlight: number | null;
  all: boolean;
  switching: NodeId | null;
};

/** A value written into a field. */
export type Edit = { field: Field; root: Expr };

/** A transition's result: the next session and the values it writes, in order. */
export type Step = { session: Session; edits: Edit[] };

const still = (session: Session): Step => ({ session, edits: [] });

/** Two steps in turn: `next` runs on the session the first one left. */
export function chain(first: Step, next: (session: Session) => Step): Step {
  const second = next(first.session);
  return { session: second.session, edits: [...first.edits, ...second.edits] };
}

/** The session an editor opens with: on `start`, its line at the input clicked, if any. */
export function openSession(stmt: Stmt, start: Field | null, hole: NodeId | null): Session {
  const root = start ? valueOf(stmt, start) : undefined;
  return {
    focus: start,
    line: root ? openLine(root, hole ?? undefined) : null,
    typed: null,
    highlight: null,
    all: false,
    switching: null,
  };
}

/** The session over `stmt` as it is now: a value changed elsewhere (an undo) reopens the line. */
export function follow(session: Session, stmt: Stmt): Session {
  const { line, focus } = session;
  if (!line) return session;
  const root = focus ? valueOf(stmt, focus) : undefined;
  if (root && JSON.stringify(root) === JSON.stringify(line.root)) return session;
  return { ...session, line: root ? openLine(root) : null };
}

/**
 * The line becomes `next`, and its value is written when it changed. The line always holds the
 * focused field's value, so the line before is what `next` is compared with.
 */
export function commit(session: Session, next: Line): Step {
  const { focus, line } = session;
  if (!focus) return still(session);
  const changed = !line || JSON.stringify(line.root) !== JSON.stringify(next.root);
  return {
    session: { ...session, line: next, highlight: null, switching: null },
    edits: changed ? [{ field: focus, root: next.root }] : [],
  };
}

/** A word that names a row exactly is chosen, as when the line is left. */
export function settleWord(session: Session, ctx: LineContext): Step {
  const { line } = session;
  return line && line.word !== "" ? commit(session, settle(line, ctx)) : still(session);
}

/** Where a click in a line landed: an expression, or an operator's symbol. */
export type Click = { id: NodeId; op: boolean };

/**
 * The keyboard moves to `field`, or leaves every field: its line opens on its value in `stmt`,
 * with the caret where `clicked` landed, or on the operator to switch.
 */
export function focusField(
  session: Session,
  stmt: Stmt,
  field: Field | null,
  clicked: Click | null,
): Session {
  const root = field ? valueOf(stmt, field) : undefined;
  const opened = root ? openLine(root) : null;
  return {
    focus: field,
    line: opened && clicked && !clicked.op ? clickAt(opened, clicked.id) : opened,
    typed: null,
    highlight: null,
    all: false,
    switching: clicked?.op ? clicked.id : null,
  };
}

/** A click in the focused field's line: the caret goes there, or the operator is to switch. */
export function clickInLine(session: Session, clicked: Click): Session {
  if (clicked.op) return { ...session, switching: clicked.id, highlight: null };
  const { line } = session;
  return line ? { ...session, line: clickAt(line, clicked.id), switching: null } : session;
}

/** The highlight shown in a list of `count` rows: the one moved to, else the first match of a word. */
export function shownHighlight(session: Session, count: number): number | null {
  const { highlight, line } = session;
  if (highlight !== null && highlight < count) return highlight;
  return line && line.word !== "" && count > 0 ? 0 : null;
}

/** A row of the list highlighted by the pointer. */
export function highlightRow(session: Session, index: number): Session {
  return { ...session, highlight: index };
}

/** ↓ or ↑ in a list of `count` rows, from the highlight shown: one row on, wrapping round. */
export function stepHighlight(
  session: Session,
  count: number,
  shown: number | null,
  step: 1 | -1,
): Session {
  if (count === 0) return session;
  const next = shown === null ? (step > 0 ? 0 : count - 1) : (shown + step + count) % count;
  return { ...session, highlight: next };
}

/** A row of the value list chosen: the operator switched to it, or the row put in the line. */
export function chooseRow(session: Session, row: Row, ctx: LineContext): Step {
  const { line, switching } = session;
  if (!line) return still(session);
  if (switching && row.kind === "entry") {
    return commit(session, switchTo(line, switching, row.entry));
  }
  return commit(session, choose(line, row, ctx).line);
}

/** What a key in a value line leaves to the editor: closing it, another field, or a new item. */
export type After = "close" | { go: 1 | -1 } | { addItem: number };

/** A key pressed in the focused value line; `taken` is false when the line leaves it alone. */
export type KeyStep = Step & { taken: boolean; after?: After };

const taken = (step: Step, after?: After): KeyStep =>
  after === undefined ? { ...step, taken: true } : { ...step, taken: true, after };

/** A key the focused value line takes; `rows` is the value list shown under it. */
export function valueKey(
  session: Session,
  key: { key: string; shiftKey: boolean },
  rows: readonly Row[],
  ctx: LineContext,
): KeyStep {
  const { line, focus } = session;
  const left: KeyStep = { ...still(session), taken: false };
  if (!line || !focus) return left;
  const shown = shownHighlight(session, rows.length);
  switch (key.key) {
    case "Escape":
      return left;
    case "ArrowDown":
    case "ArrowUp":
      return taken(
        still(stepHighlight(session, rows.length, shown, key.key === "ArrowDown" ? 1 : -1)),
      );
    case "ArrowLeft":
    case "ArrowRight":
      if (line.word !== "") return left;
      return taken(commit(session, move(line, key.key === "ArrowLeft" ? -1 : 1).line));
    case "Tab": {
      const step = key.shiftKey ? -1 : 1;
      const moved = tab(line, step, ctx);
      return taken(commit(session, moved.line), moved.move ? { go: step } : undefined);
    }
    case "Enter": {
      const row = shown === null ? undefined : rows[shown];
      if (row) return taken(chooseRow(session, row, ctx));
      if (line.word !== "") return taken(commit(session, settle(line, ctx)));
      return taken(still(session), "close");
    }
    case "Backspace":
      return taken(commit(session, backspace(line).line));
    case "Delete":
      return taken(line.selected ? commit(session, backspace(line).line) : still(session));
    default: {
      if (key.key.length !== 1) return left;
      const typed = type(line, key.key, ctx);
      // `,` in an item of a list adds the next item.
      const { index } = focus;
      const item = typed.move === "item" && index !== undefined;
      return taken(commit(session, typed.line), item ? { addItem: index + 1 } : undefined);
    }
  }
}

/** The text field inside the line ended: the caret goes after it, and Tab moves on. */
export function textEnded(
  session: Session,
  key: "Enter" | "Tab" | "ShiftTab" | "blur",
  ctx: LineContext,
): KeyStep {
  const { line } = session;
  if (!line) return { ...still(session), taken: false };
  const ended = commit(session, endText(line));
  if (key !== "Tab" && key !== "ShiftTab") return taken(ended);
  const step = key === "Tab" ? 1 : -1;
  const moved = tab(ended.session.line ?? line, step, ctx);
  const after = chain(ended, (next) => commit(next, moved.line));
  return taken(after, moved.move ? { go: step } : undefined);
}

/** The name typed in a name field, as it keeps it. */
export function typeName(session: Session, typed: string): Session {
  return { ...session, typed, highlight: null };
}

/** A name field left: what was typed and not chosen is dropped. */
export function leaveName(session: Session): Session {
  return { ...session, typed: null };
}

/** The value list shows every entry. */
export function showAll(session: Session): Session {
  return { ...session, all: true };
}

/** Whether `field` has the keyboard. */
export function focused(session: Session, field: Field): boolean {
  return sameField(session.focus, field);
}
