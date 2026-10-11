// The 52 px top bar: the back link, the title, the page's own actions, undo, redo, and `⋯`;
// nothing that runs the program.
import { useState, type ReactNode } from "react";
import { t } from "@/i18n/t";
import { editable, useMode } from "@/store/mode";
import { useProgram } from "@/store/program";
import { HelpDialog } from "@/ui/app/HelpDialog";
import { routeHash } from "@/ui/app/route";
import { Button, buttonVariants } from "@/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu";

type Props = {
  /** The page the back link leads to: Problems from a problem, Playground from its programs. */
  back: "problems" | "playground";
  title: ReactNode;
  /** Actions of the page before undo (a Playground program's `Export`). */
  actions?: ReactNode;
  /** The items of `⋯` before `Help`. */
  menu?: ReactNode;
};

/** Undo and redo, disabled when there is nothing to take back or bring back. */
function UndoRedo() {
  const canUndo = useProgram((s) => s.past.length > 0);
  const canRedo = useProgram((s) => s.future.length > 0);
  const undo = useProgram((s) => s.undo);
  const redo = useProgram((s) => s.redo);
  // Undo is an edit: only in build mode.
  const locked = !editable(useMode());
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("problem.undo")}
        disabled={!canUndo || locked}
        onClick={undo}
      >
        {t("problem.undoGlyph")}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("problem.redo")}
        disabled={!canRedo || locked}
        onClick={redo}
      >
        {t("problem.redoGlyph")}
      </Button>
    </>
  );
}

export function TopBar({ back, title, actions, menu }: Props) {
  const [help, setHelp] = useState(false);
  return (
    <header
      className="flex h-13 shrink-0 items-center justify-between gap-3 border-b px-4"
      data-testid="top-bar"
    >
      <div className="flex min-w-0 items-center gap-3">
        <a href={routeHash({ page: back })} className={buttonVariants({ variant: "outline" })}>
          {t(back === "problems" ? "problem.back" : "playground.back")}
        </a>
        {title}
      </div>
      <div className="flex items-center justify-end gap-2">
        {actions}
        <UndoRedo />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" aria-label={t("problem.more")} />}
          >
            {t("problem.moreGlyph")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {menu}
            <DropdownMenuItem onClick={() => setHelp(true)}>{t("problem.help")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <HelpDialog open={help} onOpenChange={setHelp} />
    </header>
  );
}
