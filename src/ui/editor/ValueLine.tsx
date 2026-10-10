// A value line drawn as the chart writes its expression: variables as bold words in
// their colour, an operator as its symbol, a word operation on a light underlay, an input still
// to fill as an empty field, the brackets the chart draws and those opened and not closed, the
// caret, and the word being typed. Keys go to `onKey`; clicks name the expression clicked.
import { forwardRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { t } from "@/i18n/t";
import type { Expr, NodeId } from "@/lang/types";
import { isEmptyExpr, variableOf } from "@/lang/walk";
import { cn } from "@/lib/utils";
import { getNode, keyOf } from "@/nodes/registry";
import type { Side } from "@/nodes/types";
import { bracketed, exprTemplate, exprText, isWordOperation } from "@/ui/chart/text";
import { inputs, type Line } from "./line";

type Bag = Record<string, unknown>;

type Props = {
  /** The expression drawn. */
  root: Expr;
  /** The line's editing state while it has the keyboard. */
  line: Line | null;
  label: string;
  /** The word typed matches nothing: it is underlined. */
  unmatched: boolean;
  onKey: (event: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  /** A click on a value or an input still to fill; `op` when it is an operator's symbol. */
  onClickAt: (id: NodeId, op: boolean) => void;
  /** The text being typed in a text field changes or ends. */
  onText: (id: NodeId, text: string) => void;
  onTextEnd: (key: "Enter" | "Tab" | "ShiftTab" | "blur") => void;
};

function Caret() {
  return <span className="mx-px inline-block h-4 w-px animate-pulse bg-foreground align-middle" />;
}

export const ValueLine = forwardRef<HTMLDivElement, Props>(function ValueLine(props, ref) {
  const { root, label, unmatched } = props;
  // The editing state shows only while the line has the keyboard.
  const [keys, setKeys] = useState(false);
  const line = keys ? props.line : null;
  const focused = line !== null;
  const caret = line?.caret;
  const word = (
    <>
      {line && line.word !== "" && (
        <span className={cn(unmatched && "underline decoration-destructive decoration-wavy")}>
          {line.word}
        </span>
      )}
      <Caret />
    </>
  );

  const field = (expr: Expr): ReactNode => {
    const here = caret && "at" in caret && caret.at === expr.id && !line?.selected;
    return (
      <button
        key={expr.id}
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        data-hole={expr.id}
        className={cn(
          "inline-flex h-6 min-w-8 items-center rounded border border-dashed border-muted-foreground/60 px-1 align-middle",
          here && "border-solid border-selection",
        )}
        onClick={() => props.onClickAt(expr.id, false)}
      >
        {here ? word : null}
      </button>
    );
  };

  const leaf = (expr: Expr): ReactNode => {
    const slot = getNode(keyOf(expr)).slots.find((s) => s.role === "text");
    if (line?.text === expr.id && slot) {
      const value = (expr as unknown as Bag)[slot.name];
      return (
        <input
          key={expr.id}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- the text field is where the learner types
          autoFocus
          aria-label={t("editor.textField")}
          data-text-field
          className="h-6 w-28 rounded border border-selection px-1 align-middle outline-none"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => props.onText(expr.id, event.target.value)}
          onBlur={() => props.onTextEnd("blur")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              event.stopPropagation();
              props.onTextEnd(
                event.key === "Tab" ? (event.shiftKey ? "ShiftTab" : "Tab") : "Enter",
              );
            }
          }}
        />
      );
    }
    const name = variableOf(expr);
    return (
      <button
        key={expr.id}
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        data-value={expr.id}
        className={cn(
          "cursor-text rounded-sm px-px",
          name !== undefined && "font-semibold text-variable",
        )}
        onClick={() => props.onClickAt(expr.id, false)}
      >
        {exprText(expr)}
      </button>
    );
  };

  const draw = (expr: Expr, parent?: Expr, side: Side = "left"): ReactNode => {
    const open = line?.open.includes(expr.id) ?? false;
    const brackets = (parent !== undefined && bracketed(expr, parent, side)) || open;
    let body: ReactNode;
    if (isEmptyExpr(expr)) body = field(expr);
    else if (inputs(expr).length === 0) body = leaf(expr);
    else body = operation(expr);
    const after = caret && "after" in caret && caret.after === expr.id && !line?.selected;
    return (
      <span key={expr.id} className="inline">
        {brackets && <span className="text-muted-foreground">(</span>}
        {body}
        {after && open && word}
        {brackets && <span className="text-muted-foreground">)</span>}
        {after && !open && word}
      </span>
    );
  };

  const operation = (expr: Expr): ReactNode => {
    const def = getNode(keyOf(expr));
    const bag = expr as unknown as Bag;
    const first = def.slots.find((s) => s.role === "expr");
    const pieces: ReactNode[] = [];
    const template = exprTemplate(expr);
    let at = 0;
    for (const found of template.matchAll(/\{(\w+)\}/g)) {
      const words = template.slice(at, found.index);
      if (words.trim() !== "") pieces.push(<span key={`w${at}`}>{words}</span>);
      else if (words !== "") pieces.push(" ");
      const name = found[1] ?? "";
      const slot = def.slots.find((s) => s.name === name);
      const value = bag[name];
      if (slot?.role === "expr" && value && typeof value === "object") {
        pieces.push(draw(value as Expr, expr, slot === first ? "left" : "right"));
      } else if (slot?.role === "exprs" && Array.isArray(value)) {
        (value as Expr[]).forEach((item, i) => {
          if (i > 0) pieces.push(<span key={`c${item.id}`}>, </span>);
          pieces.push(draw(item));
        });
      } else if (slot?.role === "text") {
        pieces.push(
          <button
            key={`op${expr.id}`}
            type="button"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            data-op={expr.id}
            className="cursor-pointer rounded-sm px-0.5 hover:bg-muted"
            onClick={() => props.onClickAt(expr.id, true)}
          >
            {def.text?.(expr, name) || (typeof value === "string" ? value : "")}
          </button>,
        );
      } else if (slot?.role === "id") {
        pieces.push(<span key={`id${at}`}>{typeof value === "string" ? value : ""}</span>);
      } else {
        const index = def.params?.indexOf(name) ?? -1;
        const args = Array.isArray(bag.args) ? (bag.args as Expr[]) : [];
        const arg = index >= 0 ? args[index] : undefined;
        if (arg) pieces.push(draw(arg, expr, index === 0 ? "left" : "right"));
      }
      at = found.index + found[0].length;
    }
    const tail = template.slice(at);
    if (tail.trim() !== "") pieces.push(<span key="tail">{tail}</span>);
    return isWordOperation(expr) ? (
      <span className="rounded bg-muted px-1 py-0.5" data-operation={expr.id}>
        {pieces}
      </span>
    ) : (
      <>{pieces}</>
    );
  };

  const empty = isEmptyExpr(root) && !focused;
  return (
    <div
      ref={ref}
      role="textbox"
      tabIndex={0}
      aria-label={label}
      data-value-line
      data-focused={focused || undefined}
      className={cn(
        "inline-flex min-h-8 max-w-full flex-wrap items-center gap-y-1 rounded-md border px-2 py-1 whitespace-pre-wrap outline-none",
        focused
          ? "border-selection ring-1 ring-selection"
          : "border-dashed border-muted-foreground/60",
        line?.selected && "[&>span]:rounded-sm [&>span]:bg-selection/20",
      )}
      onKeyDown={props.onKey}
      onFocus={() => {
        setKeys(true);
        props.onFocus();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setKeys(false);
      }}
    >
      {empty ? (
        <span className="text-muted-foreground">{t("editor.typeHint")}</span>
      ) : (
        <>
          {draw(root)}
          {line?.selected && <Caret />}
        </>
      )}
    </div>
  );
});
