// The list of the editor's focused slot: headed sections of rows, one highlighted,
// each with an optional symbol before its name and a note after it; `Show all` at its end.
import { useEffect, useRef } from "react";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";

export type ListItem = {
  key: string;
  label: string;
  /** Drawn as a variable: a bold word in the variable colour. */
  variable?: boolean;
  /** Before the name, in its own column (`×`). */
  symbol?: string;
  /** After the name, at the right (a variable's kind). */
  note?: string;
  /** Text before the name (`New variable`). */
  lead?: string;
};
export type ListSection = { title: string; items: ListItem[] };

type Props = {
  sections: ListSection[];
  /** The index of the highlighted row across the sections, or null. */
  highlight: number | null;
  /** The highlighted row shows the Enter key that chooses it. */
  enter: boolean;
  onHighlight: (index: number) => void;
  onChoose: (index: number) => void;
  /** `Show all`, when the list offers it. */
  onShowAll?: () => void;
};

export function EditorList(props: Props) {
  const { sections, highlight, enter } = props;
  const highlighted = useRef<HTMLButtonElement>(null);
  // A block body: browsers that return a promise from scrollIntoView would hand it to React
  // as the effect's cleanup.
  useEffect(() => {
    if (highlight === null) return;
    highlighted.current?.scrollIntoView({ block: "nearest" });
  }, [highlight]);
  // Where each section's rows start in the count across sections.
  const starts = sections.map((_, i) =>
    sections.slice(0, i).reduce((count, section) => count + section.items.length, 0),
  );
  const rows = sections.reduce((count, section) => count + section.items.length, 0);
  return (
    <div className="flex max-h-72 flex-col overflow-y-auto px-1.5 py-1.5" data-testid="editor-list">
      {rows === 0 && <p className="px-2 py-1 text-muted-foreground">{t("editor.noItems")}</p>}
      {sections.map((section, s) => (
        // oxlint-disable-next-line react/no-array-index-key -- two sections may both have no title
        <section key={`${s}:${section.title}`} aria-label={section.title} className="flex flex-col">
          {section.title !== "" && (
            <h3 className="px-2 pt-1.5 pb-0.5 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
              {section.title}
            </h3>
          )}
          {section.items.map((item, i) => {
            const at = (starts[s] ?? 0) + i;
            // A section with a symbol keeps a column for symbols.
            const symbols = section.items.some((row) => row.symbol !== undefined);
            const on = highlight === at;
            return (
              <button
                key={item.key}
                ref={on ? highlighted : undefined}
                type="button"
                tabIndex={-1}
                data-row={item.key}
                data-highlighted={on || undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left",
                  on && "bg-selection/10",
                )}
                // Pressing a row keeps the keyboard where it is.
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => props.onHighlight(at)}
                onClick={() => props.onChoose(at)}
              >
                {symbols && <span className="w-4 shrink-0 text-center">{item.symbol}</span>}
                {item.lead && <span>{item.lead}</span>}
                <span className={cn(item.variable && "font-semibold text-variable")}>
                  {item.label}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{item.note}</span>
                {on && enter && (
                  <kbd className="rounded border px-1 text-[0.7rem] text-muted-foreground">
                    {t("editor.enterKey")}
                  </kbd>
                )}
              </button>
            );
          })}
        </section>
      ))}
      {props.onShowAll && (
        <button
          type="button"
          tabIndex={-1}
          className="mt-1 self-start rounded-md px-2 py-1 text-selection hover:underline"
          onMouseDown={(event) => event.preventDefault()}
          onClick={props.onShowAll}
        >
          {t("editor.showAll")}
        </button>
      )}
    </div>
  );
}
