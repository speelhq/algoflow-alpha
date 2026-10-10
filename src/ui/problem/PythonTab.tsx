// The emitted code with line numbers; keywords, strings, numbers, and comments are
// coloured. Hovering a line outlines its node, clicking it selects the node, the selected
// node's lines are highlighted, and while running the current statement's line is too.
import { useEffect, useMemo, useRef } from "react";
import { caseInputs } from "@/challenges/cases";
import { t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { emit } from "@/python/emit";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { download } from "@/ui/app/download";
import { Button } from "@/ui/primitives/button";
import { highlight, type Token } from "@/ui/python/highlight";
import { lineOwners, linesOf } from "@/ui/python/lines";

const COLOUR: Record<Token["kind"], string> = {
  keyword: "text-violet-700",
  string: "text-emerald-700",
  number: "text-amber-700",
  comment: "text-muted-foreground italic",
  text: "",
};

/** The shown file is `main.py` (a program that uses modules adds one file per module). */
const FILE = "main.py";

function copy(code: string): void {
  // `navigator.clipboard` is absent in insecure contexts; a refused write is not worth surfacing.
  void navigator.clipboard?.writeText(code).catch(() => undefined);
}

export function PythonTab() {
  const program = useProgram((s) => s.program);
  const caseIndex = useRun((s) => s.caseIndex);
  const running = useRun((s) => s.status !== "idle");
  const activeId = useRun((s) => s.activeId);
  const selectedId = useEditor((s) => s.selectedId);
  const setHovered = useEditor((s) => s.setHovered);
  const select = useEditor((s) => s.select);

  const { code, map } = useMemo(
    () => emit(program, caseInputs(program, caseIndex)),
    [program, caseIndex],
  );
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n").map(highlight), [code]);
  const owners = useMemo(() => lineOwners(map), [map]);
  const selected = useMemo(() => linesOf(map, selectedId), [map, selectedId]);
  const active = useMemo(() => linesOf(map, running ? activeId : null), [map, running, activeId]);

  // One delegated listener pair on the list, so the lines stay plain markup.
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const ownerAt = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const number = Number(target?.closest<HTMLElement>("[data-line]")?.dataset.line);
      return Number.isFinite(number) ? (owners.get(number) ?? null) : null;
    };
    const over = (event: MouseEvent) => setHovered(ownerAt(event));
    const out = () => setHovered(null);
    const click = (event: MouseEvent) => {
      const owner = ownerAt(event);
      // A line selects its node, which the chart outlines; the editor opens from the chart.
      if (owner !== null) select(owner, undefined, false);
    };
    element.addEventListener("mouseover", over);
    element.addEventListener("mouseleave", out);
    element.addEventListener("click", click);
    return () => {
      element.removeEventListener("mouseover", over);
      element.removeEventListener("mouseleave", out);
      element.removeEventListener("click", click);
      setHovered(null); // the tab may unmount while a line is hovered
    };
  }, [owners, setHovered, select]);

  return (
    <div className="flex flex-col gap-3" data-testid="python-tab">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => copy(code)}>
          {t("python.copy")}
        </Button>
        <Button variant="outline" onClick={() => download(FILE, code, "text/x-python")}>
          {t("python.download")}
        </Button>
      </div>
      <ol
        ref={list}
        aria-label={t("python.code")}
        data-testid="python-code"
        className="rounded-lg border py-2 font-mono text-xs leading-5"
      >
        {lines.map((tokens, i) => {
          const line = i + 1;
          return (
            <li
              key={line}
              data-testid="python-line"
              data-line={line}
              data-selected={selected.has(line) || undefined}
              data-active={active.has(line) || undefined}
              className={cn(
                "flex cursor-pointer border-l-2 border-transparent hover:bg-muted/60",
                selected.has(line) && "border-selection bg-selection/10",
                active.has(line) && "border-selection bg-selection/20",
              )}
            >
              <span className="w-8 shrink-0 pr-3 text-right text-muted-foreground select-none">
                {line}
              </span>
              <pre className="whitespace-pre">
                {tokens.map((token, j) => (
                  // oxlint-disable-next-line react/no-array-index-key -- tokens are positional
                  <span key={j} className={COLOUR[token.kind]}>
                    {token.text}
                  </span>
                ))}
              </pre>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
