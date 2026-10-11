// The editable slots of the editor's sentence other than a value line: a name field, `+ value`,
// and a list of values with a remove button on each item.
import type { KeyboardEvent, ReactNode } from "react";
import { t } from "@/i18n/t";
import type { Expr } from "@/lang/types";
import { cn } from "@/lib/utils";

/** A name slot: shown as the variable it names until it has the keyboard. */
export function NameField({
  slot,
  label,
  name,
  typed,
  on,
  register,
  onFocus,
  onBlur,
  onType,
  onKey,
}: {
  slot: string;
  label: string;
  name: string;
  /** What is typed while the field has the keyboard, else null. */
  typed: string | null;
  on: boolean;
  register: (element: HTMLElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onType: (text: string) => void;
  onKey: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      ref={register}
      value={on && typed !== null ? typed : name}
      aria-label={label}
      data-name-slot={slot}
      className={cn(
        "h-8 min-w-10 rounded-md border px-1.5 outline-none [field-sizing:content]",
        on && "border-selection ring-1 ring-selection",
        !on && name === "" && "border-dashed",
        // A name not being edited reads as the variable it names.
        !on && name !== "" && "border-transparent font-semibold text-variable",
      )}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(event) => onType(event.target.value)}
      onKeyDown={onKey}
    />
  );
}

/** `+ value`: adds an optional value, or an item at the end of a list. */
export function AddValue({ onAdd, small }: { onAdd: () => void; small: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "h-7 cursor-pointer rounded-full border border-dashed px-2.5 text-muted-foreground hover:bg-muted",
        small && "text-sm",
      )}
      onClick={onAdd}
    >
      {t("editor.addValue")}
    </button>
  );
}

/** A list of values: each item's line with a remove button, separated, then `+ value`. */
export function ValueItems(props: {
  items: readonly Expr[];
  line: (item: Expr, index: number) => ReactNode;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {props.items.map((item, index) => (
        // An item keeps its field while the value in it changes.
        // oxlint-disable-next-line react/no-array-index-key -- the field is the position
        <span key={index} className="inline-flex items-center gap-0.5">
          {index > 0 && <span>{t("chart.listSeparator")}</span>}
          {props.line(item, index)}
          <button
            type="button"
            aria-label={t("editor.removeValue")}
            // Pressing it leaves the keyboard where it is, and the line as it is drawn.
            onMouseDown={(event) => event.preventDefault()}
            className="size-5 cursor-pointer rounded-full text-muted-foreground hover:bg-muted"
            onClick={() => props.onRemove(index)}
          >
            {t("editor.removeGlyph")}
          </button>
        </span>
      ))}
      <AddValue onAdd={props.onAdd} small />
    </span>
  );
}
