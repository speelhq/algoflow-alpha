// A `+` connector on an edge and the block menu it opens: a search over the blocks'
// labels and help, then the groups in menu order; choosing an entry inserts it there.
import { useMemo, useState } from "react";
import { t } from "@/i18n/t";
import type { Place } from "@/lang/types";
import { cn } from "@/lib/utils";
import { useProgram } from "@/store/program";
import { Input } from "@/ui/primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/primitives/popover";
import { insertBlock } from "./edits";
import { menuGroups, searchMenu, type BlockMenuEntry } from "./menu";

function Entries({ place, done }: { place: Place; done: () => void }) {
  const program = useProgram((s) => s.program);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => menuGroups(program, place), [program, place]);
  const shown = useMemo(() => searchMenu(groups, query), [groups, query]);
  const choose = (entry: BlockMenuEntry) => {
    if (entry.disabled) return;
    done();
    insertBlock(entry.create(), place);
  };
  const first = shown.flatMap((group) => group.entries).find((entry) => !entry.disabled);
  return (
    <div className="flex flex-col gap-2" data-testid="block-menu">
      <Input
        value={query}
        placeholder={t("menu.search")}
        aria-label={t("menu.search")}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && first) {
            event.preventDefault();
            choose(first);
          }
        }}
      />
      <div className="max-h-96 overflow-y-auto">
        {shown.length === 0 && <p className="px-2 py-1 text-muted-foreground">{t("menu.empty")}</p>}
        {shown.map((group) => (
          <section key={group.id} aria-label={group.title}>
            <h3 className="px-2 pt-2 pb-0.5 text-xs tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h3>
            {group.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={entry.disabled !== undefined}
                title={entry.help}
                data-entry={entry.id}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left",
                  entry.disabled ? "text-muted-foreground" : "hover:bg-accent",
                )}
                onClick={() => choose(entry)}
              >
                <span>{entry.text}</span>
                {entry.disabled && <span className="text-xs">{entry.disabled}</span>}
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** The `+` on an edge; `first` labels the one connector of an empty main. */
export function Connector({ place, first }: { place: Place; first: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The `+` sits on the edge; the first block's label stands beside it, clear of the edge. */}
      <div className="relative flex -translate-x-1/2 -translate-y-1/2 items-center">
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={t("chart.connector")}
              data-testid="connector"
              data-place={`${place.parent}/${place.slot}/${place.index}`}
              className="flex size-[18px] cursor-pointer items-center justify-center rounded-full border border-dashed border-selection bg-background text-xs leading-none text-selection hover:bg-selection/10"
            />
          }
        >
          {t("chart.connectorGlyph")}
        </PopoverTrigger>
        {first && (
          <button
            type="button"
            className="absolute left-[calc(100%+0.75rem)] cursor-pointer rounded-md border border-selection/60 bg-selection/10 px-2 py-1 text-sm whitespace-nowrap"
            onClick={() => setOpen(true)}
          >
            {t("chart.addFirst")}
          </button>
        )}
      </div>
      <PopoverContent side="right" align="start" className="w-80" aria-label={t("menu.label")}>
        <Entries place={place} done={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
