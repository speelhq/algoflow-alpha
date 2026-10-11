// A Playground program: the Problem page without the `Problem` tab, the Input nodes, and
// Submit; its top bar has `← Playground`, an editable title, and `Export` before undo. Its
// route has opened the program before it draws (`route.ts`).
import { t } from "@/i18n/t";
import { editable, useMode } from "@/store/mode";
import { useProgram } from "@/store/program";
import { download } from "@/ui/app/download";
import { apply } from "@/ui/editor/edits";
import { exportName } from "@/ui/editor/programs";
import { useTitle } from "@/ui/hooks/useTitle";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Canvas } from "@/ui/problem/Canvas";
import { Panel } from "@/ui/problem/Panel";
import { TopBar } from "@/ui/problem/TopBar";
import { usePageKeys } from "@/ui/problem/keys";

function TitleField() {
  const title = useProgram((s) => s.program.title);
  // The title is part of the program: it changes only in build mode.
  const locked = !editable(useMode());
  return (
    <Input
      value={title}
      aria-label={t("playground.titleLabel")}
      placeholder={t("playground.untitled")}
      disabled={locked}
      className="h-8 w-64 font-semibold"
      data-testid="program-title"
      onChange={(event) => {
        const next = event.target.value;
        apply((program) => ({ ...program, title: next }), "title");
      }}
    />
  );
}

function exportProgram(): void {
  const { program } = useProgram.getState();
  const name = exportName(program.title, t("playground.untitled"));
  download(name, `${JSON.stringify(program, null, 2)}\n`, "application/json");
}

export function ProgramPage() {
  const title = useProgram((s) => s.program.title);
  useTitle(title || t("playground.untitled"));
  usePageKeys();

  return (
    <div className="flex h-full flex-col" data-testid="program-page">
      <TopBar
        back="playground"
        title={<TitleField />}
        actions={
          <Button variant="outline" onClick={exportProgram}>
            {t("playground.export")}
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <Panel />
        <Canvas />
      </div>
    </div>
  );
}
