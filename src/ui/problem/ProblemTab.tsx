// The statement, `Example`, `Cases used by Submit`, the hints revealed one per click
// (recorded), and `Show solution` (recorded).
import type { ReactNode } from "react";
import type { Challenge } from "@/challenges";
import { localized, t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor";
import { inRun, useMode } from "@/store/mode";
import { HINTS, useProgress } from "@/store/progress";
import { dataText } from "@/ui/chart/text";
import { Button } from "@/ui/primitives/button";
import { foldLines } from "@/ui/text/fold";
import { Markdown } from "@/ui/text/MarkdownText";
import { caseText } from "./caseText";

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border px-2 text-xs text-muted-foreground">{children}</span>;
}

/** The first test's inputs and expected output, one line per value; long output folds. */
function Example({ challenge }: { challenge: Challenge }) {
  const test = challenge.tests[0];
  if (!test) return null;
  const stdout = foldLines(test.expect.stdout ?? []);
  const variables = Object.entries(test.expect.variables ?? {});
  return (
    <section>
      <Heading>{t("problem.example")}</Heading>
      <div className="rounded-lg border p-3 font-mono text-xs leading-5" data-testid="example">
        {Object.entries(test.inputs).map(([name, value]) => (
          <div key={name}>{t("chart.input", { name, value: dataText(value) })}</div>
        ))}
        {test.expect.stdout && (
          <>
            <div className="mt-1 text-muted-foreground">{t("problem.exampleOutput")}</div>
            {stdout.shown.map((line, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- output lines may repeat
              <div key={i}>{line === "" ? " " : line}</div>
            ))}
            {stdout.more > 0 && (
              <div className="text-muted-foreground">{t("problem.fold", { n: stdout.more })}</div>
            )}
          </>
        )}
        {variables.length > 0 && (
          <>
            <div className="mt-1 text-muted-foreground">{t("problem.exampleVariables")}</div>
            {variables.map(([name, value]) => (
              <div key={name}>{t("problem.assignment", { name, value: dataText(value) })}</div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

export function ProblemTab({ challenge }: { challenge: Challenge }) {
  const id = challenge.id;
  const entry = useProgress((s) => (Object.hasOwn(s.entries, id) ? s.entries[id] : undefined));
  const hintShown = useProgress((s) => s.hintShown);
  const solutionShown = useProgress((s) => s.solutionShown);
  const showSolution = useEditor((s) => s.showSolution);
  const mode = useMode();
  const solution = mode === "solution";
  const revealed = Math.min(entry?.hints ?? 0, challenge.hints.length);

  return (
    <div className="space-y-4" data-testid="problem-tab">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{localized(challenge.title)}</h2>
        <Tag>{t(`problems.difficulty.${challenge.difficulty}`)}</Tag>
        {challenge.topics.map((topic) => (
          <Tag key={topic}>{t(`problems.topic.${topic}`)}</Tag>
        ))}
      </div>
      <Markdown text={localized(challenge.description)} />
      <Example challenge={challenge} />
      <section>
        <Heading>{t("problem.cases")}</Heading>
        <p className="font-mono text-xs" data-testid="cases">
          {challenge.tests.map((test) => caseText(test.inputs)).join(t("problem.caseSeparator"))}
        </p>
      </section>
      <section className="space-y-2 border-t pt-3" data-testid="hints">
        <div className="flex items-center gap-2">
          <span className="font-medium">{t("problem.hints")}</span>
          <span className="text-muted-foreground">
            {t("problem.hintsShown", { n: revealed, m: HINTS })}
          </span>
          <Button
            variant="outline"
            className="ml-auto"
            disabled={revealed >= challenge.hints.length}
            onClick={() => hintShown(id, revealed + 1)}
          >
            {t("problem.showHint")}
          </Button>
        </div>
        <ol className="list-decimal space-y-2 pl-5">
          {challenge.hints.slice(0, revealed).map((hint, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- hints are ordered and never move
            <li key={i}>
              <Markdown text={localized(hint)} />
            </li>
          ))}
        </ol>
      </section>
      <section className="flex items-center gap-2 border-t pt-3">
        <span className="font-medium">{t("problem.solution")}</span>
        {solution && <span className="text-muted-foreground">{t("problem.solutionShown")}</span>}
        <Button
          variant="outline"
          className={cn("ml-auto", solution && "border-ring bg-accent")}
          aria-pressed={solution}
          // The chart stays the run's in run mode.
          disabled={inRun(mode)}
          onClick={() => {
            showSolution(true);
            solutionShown(id);
          }}
        >
          {t("problem.showSolution")}
        </Button>
      </section>
    </div>
  );
}
