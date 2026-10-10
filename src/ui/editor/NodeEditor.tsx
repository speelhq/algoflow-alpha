// The node editor: a popover beside the selected node holding the node's name field
// with `Duplicate` and `Delete`, the block's sentence with its slots editable in place (names
// as name fields, values as value lines, lists of values with add and remove), the list of
// the focused slot, and the explanation line. Reads slot roles, never a kind.
import { Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { getChallenge } from "@/challenges";
import { errorText, nodeText, t, type MessageKey } from "@/i18n/t";
import {
  duplicateStmt,
  hoistAssign,
  removeItem,
  removeStmt,
  setExpr,
  setSlot,
  setStmtName,
  stmtName,
} from "@/lang/edit";
import { newId } from "@/lang/id";
import { chartOf, variableKinds } from "@/lang/kinds";
import { visibleAt } from "@/lang/scope";
import type { Diagnostic, Expr, Id, NodeId, Program, Stmt, Target } from "@/lang/types";
import { validate } from "@/lang/validate";
import { allExprs, isEmptyExpr, isExpr, nodesById, ownerStmts } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { getNode, keyOf } from "@/nodes/registry";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { templateOf } from "@/ui/chart/text";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Popover, PopoverTrigger } from "@/ui/primitives/popover";
import { apply } from "./edits";
import { EditorList, type ListItem, type ListSection } from "./EditorList";
import { allEntries, entryOf } from "./entries";
import {
  explainLine,
  explainVariable,
  functionLabel,
  helpParts,
  type Explanation,
} from "./explain";
import {
  backspace,
  choose,
  clickAt,
  endText,
  find,
  matches,
  move,
  openLine,
  setText,
  settle,
  switchTo,
  tab,
  type,
  type Line,
  type LineContext,
  type Row,
} from "./line";
import { listRows, listSections } from "./list";
import { nameChars, nameSections, type NameRow } from "./names";
import { ValueLine } from "./ValueLine";
import { EDITOR_GAP, EDITOR_WIDTH } from "./size";

type Bag = Record<string, unknown>;

/** The diagnostics nodes show, by statement: no empty slot, whose placeholder is its mark. */
export function flaggedStatements(program: Program): Map<NodeId, Diagnostic[]> {
  const owners = ownerStmts(program);
  const flagged = new Map<NodeId, Diagnostic[]>();
  for (const d of validate(program)) {
    if (d.code === "E_EMPTY_SLOT") continue;
    const owner = owners.get(d.nodeId) ?? d.nodeId;
    flagged.set(owner, [...(flagged.get(owner) ?? []), d]);
  }
  return flagged;
}

/** The diagnostics node `id` shows. */
export function nodeDiagnostics(program: Program, id: NodeId): Diagnostic[] {
  return flaggedStatements(program).get(id) ?? [];
}

/** The same diagnostic in another validation of the program: same node, code, and params. */
function sameDiagnostic(a: Diagnostic, b: Diagnostic): boolean {
  return (
    a.nodeId === b.nodeId &&
    a.code === b.code &&
    JSON.stringify(a.params) === JSON.stringify(b.params)
  );
}

/** Applies a diagnostic's fix; only the fixes validation names exist. */
export function applyFix(diagnostic: Diagnostic): void {
  if (diagnostic.fix !== "hoistAssign") return;
  const { frame, name } = diagnostic.params;
  if (typeof frame === "string" && typeof name === "string") {
    apply((program) => hoistAssign(program, frame, name));
  }
}

/** A diagnostic's message, with the button applying its fix when it has one. */
export function DiagnosticMessage({ diagnostic }: { diagnostic: Diagnostic }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-2"
      role="alert"
    >
      <span className="flex-1 text-destructive">{errorText(diagnostic)}</span>
      {diagnostic.fix && (
        <Button size="sm" variant="outline" onClick={() => applyFix(diagnostic)}>
          {t(`editor.fix.${diagnostic.fix}` as "editor.fix.hoistAssign", diagnostic.params)}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- slots

/** One editable slot of the sentence: a name, a value, or an item of a list of values. */
type Field = { slot: string; role: "id" | "target" | "expr" | "text"; index?: number };

const fieldKey = (field: Field) => `${field.slot}:${field.index ?? ""}`;
const sameField = (a: Field | null, b: Field | null) =>
  a !== null && b !== null && fieldKey(a) === fieldKey(b);

/** The name in an `id` slot, or in a `target` slot holding a variable. */
function nameOf(stmt: Stmt, slot: string): string | undefined {
  const value = (stmt as unknown as Bag)[slot];
  if (typeof value === "string") return value;
  const target = value as Target | undefined;
  return target?.kind === "var" ? target.name : undefined;
}

function setName(program: Program, stmt: Stmt, slot: string, name: string): Program {
  const role = getNode(keyOf(stmt)).slots.find((s) => s.name === slot)?.role;
  return setSlot(program, stmt.id, slot, role === "target" ? { kind: "var", name } : name);
}

/** The fields of the sentence, in its reading order. */
function fieldsOf(stmt: Stmt, program: Program): Field[] {
  const def = getNode(keyOf(stmt));
  const bag = stmt as unknown as Bag;
  const out: Field[] = [];
  for (const found of templateOf(stmt, program).matchAll(/\{(\w+)\}/g)) {
    const slot = def.slots.find((s) => s.name === found[1]);
    const value = slot ? bag[slot.name] : undefined;
    if (!slot) continue;
    if ((slot.role === "id" || slot.role === "target") && nameOf(stmt, slot.name) !== undefined) {
      out.push({ slot: slot.name, role: slot.role });
    } else if (slot.role === "expr" && isExpr(value)) out.push({ slot: slot.name, role: "expr" });
    else if (slot.role === "exprs" && Array.isArray(value)) {
      value.forEach((_, index) => out.push({ slot: slot.name, role: "expr", index }));
    } else if (slot.role === "text") out.push({ slot: slot.name, role: "text" });
  }
  return out;
}

function valueOf(stmt: Stmt, field: Field): Expr | undefined {
  const value = (stmt as unknown as Bag)[field.slot];
  const item =
    field.index === undefined ? value : Array.isArray(value) ? value[field.index] : undefined;
  return isExpr(item) ? item : undefined;
}

/** Whether a field still has something to fill: an empty name or an input at any depth. */
function toFill(stmt: Stmt, field: Field): boolean {
  if (field.role === "id" || field.role === "target") return nameOf(stmt, field.slot) === "";
  const value = valueOf(stmt, field);
  return value !== undefined && [...allExprs(value)].some(isEmptyExpr);
}

// ---------------------------------------------------------------- the node's name

/** The node's name field: one line in the learner's words, stored trimmed. */
function NameOfNode({ stmt }: { stmt: Stmt }) {
  const stored = stmt.name ?? "";
  const [text, setText] = useState(stored);
  // An undo changes the stored name under the field.
  if (stmtName(text) !== stored) setText(stored);
  return (
    <label className="flex h-9 flex-1 items-center gap-2 rounded-md border px-2.5 focus-within:border-selection">
      <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {t("editor.name")}
      </span>
      <input
        value={text}
        placeholder={t("editor.nameHint")}
        aria-label={t("editor.name")}
        data-testid="node-name"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => {
          const next = event.target.value.replace(/[\r\n]+/g, " ");
          setText(next);
          apply((p) => setStmtName(p, stmt.id, next), `${stmt.id}:name`);
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------- the body

type Initial = { slot: string | null; hole: NodeId | null };

function Body({ stmt, program, initial }: { stmt: Stmt; program: Program; initial: Initial }) {
  const def = getNode(keyOf(stmt));
  const bag = stmt as unknown as Bag;
  const led = useEditor((s) => s.diagnostic);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const fields = fieldsOf(stmt, program);
  const elements = useRef(new Map<string, HTMLElement | null>());

  // The slot clicked on the node, else the first slot still to fill, takes the keyboard.
  const [start] = useState<Field | null>(() => {
    if (initial.slot !== null) {
      const clicked = fields.filter((field) => field.slot === initial.slot);
      const holding =
        initial.hole === null
          ? undefined
          : clicked.find((field) => {
              const value = valueOf(stmt, field);
              return value !== undefined && find(value, initial.hole ?? "") !== undefined;
            });
      return holding ?? clicked[0] ?? null;
    }
    return fields.find((field) => toFill(stmt, field)) ?? null;
  });
  const [focus, setFocus] = useState<Field | null>(start);
  const [line, setLine] = useState<Line | null>(() => {
    const root = start ? valueOf(stmt, start) : undefined;
    return root ? openLine(root, initial.hole ?? undefined) : null;
  });
  const [typed, setTyped] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const [switching, setSwitching] = useState<NodeId | null>(null);
  const [focused, setFocused] = useState<Field | null>(null);

  // A change made elsewhere (an undo) replaces the value under the line.
  const shownRoot = focus ? valueOf(stmt, focus) : undefined;
  if (line && (!shownRoot || JSON.stringify(shownRoot) !== JSON.stringify(line.root))) {
    setLine(shownRoot ? openLine(shownRoot) : null);
  }

  // The focused field takes the keyboard once it is drawn.
  useEffect(() => {
    if (focus && !sameField(focus, focused)) elements.current.get(fieldKey(focus))?.focus();
  }, [focus, focused]);

  const chart = chartOf(program, stmt.id);
  const kinds = variableKinds(program, chart);
  const ctx: LineContext = useMemo(
    () => ({
      variables: visibleAt(program, stmt.id) ?? [],
      kinds,
      scope: {
        classes: program.classes.map((cls) => cls.name),
        functions: program.functions.map((fn) => fn.name),
      },
      functions: program.functions.map((fn) => ({ name: fn.name, params: fn.params })),
    }),
    [program, stmt.id, kinds],
  );
  const kindName = (name: Id) => {
    const kind = kinds.get(name);
    return kind ? t(`editor.kind.${kind}` as MessageKey) : undefined;
  };

  // The diagnostic Run led to is shown while the program still has it, once.
  const diagnostics = nodeDiagnostics(program, stmt.id);
  const still = led ? validate(program).find((d) => sameDiagnostic(d, led)) : undefined;
  if (still && (ownerStmts(program).get(still.nodeId) ?? still.nodeId) === stmt.id) {
    if (!diagnostics.includes(still)) diagnostics.unshift(still);
  }

  // ------------------------------------------------------------ moving between fields

  /** Moves the keyboard to `field`; `clicked`, an expression clicked in its line, places the caret. */
  const enter = (field: Field | null, clicked?: { id: NodeId; op: boolean }) => {
    // A word that names one exactly is chosen as the line is left.
    if (line && line.word !== "") commit(settle(line, ctx));
    setFocus(field);
    setTyped(null);
    setHighlight(null);
    setAll(false);
    setSwitching(null);
    const placed = useProgram.getState().program;
    const now = nodesById(placed).get(stmt.id) as Stmt | undefined;
    const root = field && now ? valueOf(now, field) : undefined;
    const opened = root ? openLine(root) : null;
    setLine(opened && clicked && !clicked.op ? clickAt(opened, clicked.id) : opened);
    if (clicked?.op) setSwitching(clicked.id);
  };

  /** Leaves the focused field for the next or previous one. */
  const go = (step: 1 | -1, from: Field | null = focus) => {
    const at = from ? fields.findIndex((field) => sameField(field, from)) : -1;
    const next = fields[at + step];
    if (next) enter(next);
  };

  // ------------------------------------------------------------ the value line

  const commit = (next: Line) => {
    if (!focus) return;
    const current = valueOf(stmt, focus);
    if (JSON.stringify(current) !== JSON.stringify(next.root)) {
      const at = focus;
      apply((p) => setExpr(p, stmt.id, at.slot, next.root, at.index), `${stmt.id}:${fieldKey(at)}`);
    }
    setLine(next);
    setHighlight(null);
    setSwitching(null);
  };

  const switchSections = (): { rows: Row[]; sections: ListSection[] } => {
    const held = line && switching ? find(line.root, switching) : undefined;
    const current = held ? entryOf(held) : undefined;
    const others = allEntries().filter(
      (entry) =>
        current !== undefined &&
        entry !== current &&
        entry.def === current.def &&
        entry.menu.group === current.menu.group,
    );
    const rows = others.map((entry): Row => ({ kind: "entry", entry }));
    const title = current ? t(`editor.lists.${current.menu.group}` as MessageKey) : "";
    return { rows, sections: rows.length > 0 ? [{ title, items: rows.map(rowItem) }] : [] };
  };

  const rowItem = (row: Row, index: number): ListItem => {
    switch (row.kind) {
      case "variable":
        return {
          key: `v:${row.name}:${index}`,
          label: row.name,
          variable: true,
          note: kindName(row.name),
        };
      case "entry":
        return {
          key: `e:${row.entry.id}`,
          label: row.entry.label,
          ...(row.entry.menu.symbol ? { symbol: row.entry.menu.symbol } : {}),
        };
      case "function":
        return { key: `f:${row.fn.name}`, label: functionLabel(row.fn) };
      case "brackets":
        return { key: "brackets", label: t("editor.brackets"), symbol: t("editor.bracketsGlyph") };
    }
  };

  const valueList = (): { rows: Row[]; sections: ListSection[] } => {
    if (!line) return { rows: [], sections: [] };
    if (switching) return switchSections();
    const listed = listSections(line, ctx, all);
    let index = 0;
    const sections = listed.map((section) => ({
      title: t(`editor.lists.${section.group}` as MessageKey),
      items: section.rows.map((row) => rowItem(row, (index += 1))),
    }));
    return { rows: listRows(listed), sections };
  };

  const shownHighlight = (rows: readonly unknown[]) =>
    highlight !== null && highlight < rows.length
      ? highlight
      : line && line.word !== "" && rows.length > 0
        ? 0
        : null;

  const chooseRow = (row: Row) => {
    if (!line) return;
    if (switching && row.kind === "entry") return commit(switchTo(line, switching, row.entry));
    commit(choose(line, row, ctx).line);
  };

  /** Adds a value to a slot: an optional value, or an item at `at` of a list (the end by default). */
  const addItem = (slot: string, at?: number) => {
    const empty: Expr = { id: newId(), kind: "empty" };
    const added = (p: Program): Program => {
      const items = (nodesById(p).get(stmt.id) as unknown as Bag | undefined)?.[slot];
      if (at === undefined || !Array.isArray(items) || at >= items.length) {
        return setExpr(p, stmt.id, slot, empty, at);
      }
      // The items from `at` on move one place on, and the new one takes `at`.
      let next = p;
      for (let j = items.length - 1; j >= at; j -= 1) {
        next = setExpr(next, stmt.id, slot, items[j] as Expr, j + 1);
      }
      return setExpr(next, stmt.id, slot, empty, at);
    };
    if (!apply(added)) return;
    const placed = nodesById(useProgram.getState().program).get(stmt.id) as Stmt | undefined;
    const items = placed ? (placed as unknown as Bag)[slot] : undefined;
    const index = Array.isArray(items)
      ? items.findIndex((item) => isExpr(item) && item.id === empty.id)
      : -1;
    const isList = def.slots.find((s) => s.name === slot)?.role === "exprs";
    enter({ slot, role: "expr", ...(isList ? { index } : {}) });
  };

  const onValueKey = (event: KeyboardEvent<HTMLDivElement>, rows: Row[]) => {
    // Keys typed in a text field inside the line are the field's.
    if (event.target instanceof HTMLInputElement) return;
    if (!line || !focus || event.ctrlKey || event.metaKey || event.altKey) return;
    const shown = shownHighlight(rows);
    switch (event.key) {
      case "Escape":
        return;
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (rows.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlight(
          shown === null
            ? step > 0
              ? 0
              : rows.length - 1
            : (shown + step + rows.length) % rows.length,
        );
        return;
      }
      case "ArrowLeft":
      case "ArrowRight":
        if (line.word !== "") return;
        event.preventDefault();
        commit(move(line, event.key === "ArrowLeft" ? -1 : 1).line);
        return;
      case "Tab": {
        event.preventDefault();
        const step = event.shiftKey ? -1 : 1;
        const moved = tab(line, step, ctx);
        commit(moved.line);
        if (moved.move) go(step);
        return;
      }
      case "Enter": {
        event.preventDefault();
        const row = shown === null ? undefined : rows[shown];
        if (row) return chooseRow(row);
        if (line.word !== "") return commit(settle(line, ctx));
        closeEditor();
        return;
      }
      case "Backspace":
        event.preventDefault();
        commit(backspace(line).line);
        return;
      case "Delete":
        event.preventDefault();
        if (line.selected) commit(backspace(line).line);
        return;
      default: {
        if (event.key.length !== 1) return;
        event.preventDefault();
        const typedKey = type(line, event.key, ctx);
        commit(typedKey.line);
        const list = def.slots.find((s) => s.name === focus.slot)?.role === "exprs";
        if (typedKey.move === "item" && list) addItem(focus.slot, (focus.index ?? 0) + 1);
      }
    }
  };

  // ------------------------------------------------------------ names

  const asked = Object.keys(getChallenge(program.challengeId)?.tests[0]?.expect.variables ?? {});
  const nameList = (field: Field) => {
    const listed = nameSections(program, asked, typed ?? "");
    const rows: NameRow[] = listed.flatMap((section) => section.rows);
    const sections: ListSection[] = listed.map((section) => ({
      title:
        section.group === "problem"
          ? t("editor.thisProblem")
          : section.group === "variables"
            ? t("editor.lists.variables")
            : "",
      items: section.rows.map((row) => ({
        key: `${row.kind}:${row.name}`,
        label: row.name,
        variable: true,
        ...(row.kind === "new" ? { lead: t("editor.newVariable") } : { note: kindName(row.name) }),
      })),
    }));
    return { rows, sections, field };
  };

  /** The row highlighted while a name is typed: the whole name, else the first. */
  const typedRow = (rows: readonly NameRow[]): number | null => {
    if (!typed) return null;
    const whole = rows.findIndex((row) => row.kind === "name" && row.name === typed);
    return whole >= 0 ? whole : rows.length > 0 ? 0 : null;
  };

  const chooseName = (field: Field, name: Id) => {
    apply((p) => setName(p, stmt, field.slot, name));
    setTyped(null);
    go(1, field);
  };

  const onNameKey = (event: KeyboardEvent<HTMLInputElement>, field: Field, rows: NameRow[]) => {
    const shown = highlight !== null && highlight < rows.length ? highlight : typedRow(rows);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (rows.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlight(
          shown === null
            ? step > 0
              ? 0
              : rows.length - 1
            : (shown + step + rows.length) % rows.length,
        );
        return;
      }
      case "Enter": {
        event.preventDefault();
        const row = shown === null ? undefined : rows[shown];
        if (row) return chooseName(field, row.name);
        const last = fields.at(-1);
        if (typed === null && last && sameField(last, field)) return closeEditor();
        if (typed === null) return go(1, field);
        return;
      }
      case "Tab":
        event.preventDefault();
        go(event.shiftKey ? -1 : 1, field);
        return;
      default:
        return;
    }
  };

  // ------------------------------------------------------------ the sentence

  const register = (field: Field) => (element: HTMLElement | null) => {
    elements.current.set(fieldKey(field), element);
  };

  const widget = (name: string): ReactNode => {
    const slot = def.slots.find((s) => s.name === name);
    if (!slot) return null;
    const value = bag[name];
    switch (slot.role) {
      case "id":
      case "target": {
        const current = nameOf(stmt, name);
        if (current === undefined) return null;
        const field: Field = { slot: name, role: slot.role };
        const on = sameField(focus, field);
        return (
          <input
            key={name}
            ref={register(field)}
            value={on && typed !== null ? typed : current}
            aria-label={name}
            data-name-slot={name}
            className={cn(
              "h-8 min-w-10 rounded-md border px-1.5 outline-none [field-sizing:content]",
              on && "border-selection ring-1 ring-selection",
              !on && current === "" && "border-dashed",
              // A name not being edited reads as the variable it names.
              !on && current !== "" && "border-transparent font-semibold text-variable",
            )}
            onFocus={() => {
              setFocused(field);
              if (!sameField(focus, field)) enter(field);
            }}
            onBlur={() => setTyped(null)}
            onChange={(event) => {
              setTyped(nameChars(event.target.value));
              setHighlight(null);
            }}
            onKeyDown={(event) => onNameKey(event, field, nameList(field).rows)}
          />
        );
      }
      case "text":
        return (
          <Input
            key={name}
            value={typeof value === "string" ? value : ""}
            aria-label={name}
            className="h-8 w-48"
            onChange={(event) =>
              apply((p) => setSlot(p, stmt.id, name, event.target.value), `${stmt.id}:${name}`)
            }
          />
        );
      case "expr":
        return isExpr(value) ? (
          lineWidget({ slot: name, role: "expr" }, value)
        ) : (
          <button
            key={name}
            type="button"
            className="h-7 cursor-pointer rounded-full border border-dashed px-2.5 text-muted-foreground hover:bg-muted"
            onClick={() => addItem(name)}
          >
            {t("editor.addValue")}
          </button>
        );
      case "exprs": {
        const items = Array.isArray(value) ? value.filter(isExpr) : [];
        return (
          <span key={name} className="inline-flex flex-wrap items-center gap-1">
            {items.map((item, index) => (
              // An item keeps its field while the value in it changes.
              // oxlint-disable-next-line react/no-array-index-key -- the field is the position
              <span key={index} className="inline-flex items-center gap-0.5">
                {index > 0 && <span>{t("editor.listSeparator")}</span>}
                {lineWidget({ slot: name, role: "expr", index }, item)}
                <button
                  type="button"
                  aria-label={t("editor.removeValue")}
                  // Pressing it leaves the keyboard where it is, and the line as it is drawn.
                  onMouseDown={(event) => event.preventDefault()}
                  className="size-5 cursor-pointer rounded-full text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    if (apply((p) => removeItem(p, stmt.id, name, index))) enter(null);
                  }}
                >
                  {t("editor.removeGlyph")}
                </button>
              </span>
            ))}
            <button
              type="button"
              className="h-7 cursor-pointer rounded-full border border-dashed px-2.5 text-sm text-muted-foreground hover:bg-muted"
              onClick={() => addItem(name)}
            >
              {t("editor.addValue")}
            </button>
          </span>
        );
      }
      default:
        return null;
    }
  };

  const valueRows = focus?.role === "expr" ? valueList() : { rows: [], sections: [] };

  const lineWidget = (field: Field, root: Expr): ReactNode => {
    const on = sameField(focus, field) && line !== null;
    const shown = on ? line : null;
    return (
      <ValueLine
        key={fieldKey(field)}
        ref={register(field)}
        root={root}
        line={shown}
        label={field.slot}
        unmatched={shown !== null && shown.word !== "" && matches(shown, ctx).length === 0}
        onKey={(event) => onValueKey(event, valueRows.rows)}
        onFocus={() => {
          setFocused(field);
          if (!sameField(focus, field)) enter(field);
        }}
        onClickAt={(id, op) => {
          if (!sameField(focus, field)) {
            enter(field, { id, op });
            return;
          }
          if (!line) return;
          if (op) {
            setSwitching(id);
            setHighlight(null);
            return;
          }
          setLine(clickAt(line, id));
          setSwitching(null);
        }}
        onText={(id, text) => commit(setText(line ?? openLine(root), id, text))}
        onTextEnd={(key) => {
          if (!line) return;
          // The line takes the keyboard back first: the text field's blur ends it once more.
          if (key !== "blur") elements.current.get(fieldKey(field))?.focus();
          const ended = endText(line);
          commit(ended);
          if (key === "Tab" || key === "ShiftTab") {
            const moved = tab(ended, key === "Tab" ? 1 : -1, ctx);
            commit(moved.line);
            if (moved.move) go(key === "Tab" ? 1 : -1);
          }
        }}
      />
    );
  };

  const template = templateOf(stmt, program);
  const sentence: ReactNode[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    const text = template.slice(at, found.index).trim();
    if (text !== "") sentence.push(<span key={`t${at}`}>{text}</span>);
    sentence.push(widget(found[1] ?? ""));
    at = found.index + found[0].length;
  }
  const tail = template.slice(at).trim();
  if (tail !== "") sentence.push(<span key="tail">{tail}</span>);

  // ------------------------------------------------------------ the list and its explanation

  let list: ReactNode = null;
  let explanation: Explanation | undefined;
  if (focus && (focus.role === "id" || focus.role === "target")) {
    const names = nameList(focus);
    const shown =
      highlight !== null && highlight < names.rows.length ? highlight : typedRow(names.rows);
    const row = shown === null ? undefined : names.rows[shown];
    list = (
      <EditorList
        sections={names.sections}
        highlight={shown}
        enter={typed !== null}
        onHighlight={setHighlight}
        onChoose={(index) => {
          const chosen = names.rows[index];
          if (chosen) chooseName(focus, chosen.name);
        }}
      />
    );
    explanation = row
      ? {
          name: row.name,
          variable: true,
          parts: [
            {
              text:
                row.kind === "new"
                  ? t("editor.explain.newVariable", { name: row.name })
                  : explainVariable(program, stmt.id, row.name),
            },
          ],
        }
      : { name: "", parts: [{ text: t("editor.explain.name") }] };
  } else if (focus?.role === "expr" && line) {
    const { rows, sections } = valueRows;
    const shown = shownHighlight(rows);
    list = (
      <EditorList
        sections={sections}
        highlight={shown}
        enter={line.word !== ""}
        onHighlight={setHighlight}
        onChoose={(index) => {
          const row = rows[index];
          if (row) chooseRow(row);
        }}
        {...(line.word === "" && !switching && !all ? { onShowAll: () => setAll(true) } : {})}
      />
    );
    explanation = explainLine(
      line,
      ctx,
      shown === null ? undefined : rows[shown],
      program,
      stmt.id,
    );
  }
  explanation ??= { name: nodeText(def.key, "label"), parts: helpParts(nodeText(def.key, "help")) };

  return (
    <div className="flex flex-col" data-testid="node-editor" data-node={stmt.id}>
      {diagnostics.length > 0 && (
        <div className="flex flex-col gap-2 p-2.5 pb-0">
          {diagnostics.map((d, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- diagnostics have no id of their own
            <DiagnosticMessage key={i} diagnostic={d} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 border-b p-2.5">
        <NameOfNode stmt={stmt} />
        <Button
          variant="outline"
          size="icon"
          aria-label={t("editor.duplicate")}
          title={t("editor.duplicate")}
          onClick={() => apply((p) => duplicateStmt(p, stmt.id))}
        >
          <Copy />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("editor.delete")}
          title={t("editor.delete")}
          onClick={() => {
            if (apply((p) => removeStmt(p, stmt.id))) select(null);
          }}
        >
          <Trash2 />
        </Button>
      </div>
      <div
        className="flex flex-wrap items-center gap-1.5 border-b p-2.5 text-[0.95rem]"
        data-testid="editor-sentence"
      >
        {sentence}
      </div>
      {list && <div className="border-b">{list}</div>}
      <div
        className="flex items-baseline gap-2 rounded-b-lg bg-muted/40 px-2.5 py-2 text-[0.85rem]"
        data-testid="explanation"
      >
        {explanation.name !== "" && (
          <span className={cn("font-semibold", explanation.variable && "text-variable")}>
            {explanation.name}
          </span>
        )}
        <span>
          {explanation.parts.map((part, i) => (
            <span
              // oxlint-disable-next-line react/no-array-index-key -- parts are positional
              key={i}
              className={cn(
                part.underline && "underline underline-offset-2",
                part.slot === "key" && "rounded bg-muted px-1 font-mono text-[0.8rem]",
              )}
            >
              {part.text}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/** The editor of statement `id`, anchored to the element it is rendered in. */
export function NodeEditor({ id }: { id: NodeId }) {
  const program = useProgram((s) => s.program);
  const slot = useEditor((s) => s.slot);
  const hole = useEditor((s) => s.hole);
  const select = useEditor((s) => s.select);
  const closeEditor = useEditor((s) => s.closeEditor);
  const [boundary, setBoundary] = useState<Element | null>(null);
  const node = nodesById(program).get(id);
  if (!node || !("kind" in node) || getNode(keyOf(node)).shape !== "stmt") return null;
  return (
    <Popover
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (details.reason === "escape-key") select(null);
        else closeEditor();
      }}
    >
      <PopoverTrigger
        render={
          <div
            ref={(element) => setBoundary(element?.closest("[data-canvas]") ?? null)}
            className="pointer-events-none size-full"
            aria-hidden
          />
        }
      />
      {/* On the node's right, where the chart makes room, and inside the canvas, so the
          panel's statement stays readable; it moves only down or up to fit. */}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="right"
          align="start"
          sideOffset={EDITOR_GAP}
          collisionBoundary={boundary ?? "clipping-ancestors"}
          collisionPadding={EDITOR_GAP}
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            style={{ width: EDITOR_WIDTH }}
            className="z-50 flex flex-col rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
            aria-label={t("editor.label")}
            // The keyboard stays with the chart unless a slot takes it.
            initialFocus={false}
            finalFocus={false}
          >
            <Body
              key={`${id}:${slot ?? ""}:${hole ?? ""}`}
              stmt={node as Stmt}
              program={program}
              initial={{ slot, hole }}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
