// The Problem page: the top bar, then two regions, the panel and the canvas. Its route has
// opened the problem's program before it draws (`route.ts`).
import { getChallenge, type Challenge } from "@/challenges";
import { localized, t } from "@/i18n/t";
import { openInPlayground } from "@/ui/editor/programs";
import { useTitle } from "@/ui/hooks/useTitle";
import { DropdownMenuItem } from "@/ui/primitives/dropdown-menu";
import { Canvas } from "./Canvas";
import { Panel } from "./Panel";
import { TopBar } from "./TopBar";
import { usePageKeys } from "./keys";

export function ProblemPage({ id }: { id: string }) {
  const challenge = getChallenge(id);
  return challenge ? <Problem challenge={challenge} /> : null;
}

function Problem({ challenge }: { challenge: Challenge }) {
  const title = localized(challenge.title);
  useTitle(title);
  usePageKeys();

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
