// The Problem page: the top bar, then two regions, the panel and the canvas.
// Opening a problem loads its program and discards any runner; it opens on
// the first tab.
import { useEffect } from "react";
import { getChallenge, type Challenge } from "@/challenges";
import { localized, t } from "@/i18n/t";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { openInPlayground } from "@/ui/editor/programs";
import { useEditKeys } from "@/ui/editor/useEditKeys";
import { useTitle } from "@/ui/hooks/useTitle";
import { DropdownMenuItem } from "@/ui/primitives/dropdown-menu";
import { Canvas } from "./Canvas";
import { Panel } from "./Panel";
import { TopBar } from "./TopBar";
import { useRunKeys } from "./useRunKeys";

export function ProblemPage({ id }: { id: string }) {
  const challenge = getChallenge(id);
  return challenge ? <Problem challenge={challenge} /> : null;
}

function Problem({ challenge }: { challenge: Challenge }) {
  const title = localized(challenge.title);
  useTitle(title);
  useRunKeys();
  useEditKeys();
  useEffect(() => {
    useProgram.getState().load(challenge.id);
    // Opening a problem selects the first test's inputs, also when it was open before.
    useRun.getState().selectCase(0);
    useEditor.getState().open("problem");
  }, [challenge.id]);

  return (
    <div className="flex h-full flex-col" data-testid="problem-page">
      <TopBar
        back="problems"
        title={<h1 className="truncate font-semibold">{title}</h1>}
        menu={
          <>
            <DropdownMenuItem onClick={() => openInPlayground(title)}>
              {t("problem.openInPlayground")}
            </DropdownMenuItem>
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <Panel challenge={challenge} />
        <Canvas challenge={challenge} />
      </div>
    </div>
  );
}
