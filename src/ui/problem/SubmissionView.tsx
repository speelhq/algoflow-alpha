// The submission in the `Result` tab. A wrong answer is its rows and
// nothing else: the title, `k of n cases passed`, one chip per case, the selected
// case's rows with the first difference marked, and `▶ Watch this case`. An accepted one
// says what comes next.
import { useMemo } from "react";
import type { Challenge } from "@/challenges";
import { nextProblem } from "@/challenges/next";
import { firstDifference, resultRows } from "@/challenges/rows";
import { errorText, localized, t } from "@/i18n/t";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor";
import { statusOf, useProgress } from "@/store/progress";
import { useRun } from "@/store/run";
import { useTests } from "@/store/tests";
import { navigate, routeHash } from "@/ui/app/route";
import { openInPlayground } from "@/ui/editor/programs";
import { Button, buttonVariants } from "@/ui/primitives/button";
import { Markdown } from "@/ui/text/MarkdownText";
import { startRun } from "./actions";
import { caseText } from "./caseText";
import { ResultRows } from "./ResultRows";

function Chips({ challenge }: { challenge: Challenge }) {
  const results = useTests((s) => s.results);
  const selected = useTests((s) => s.selected);
  const select = useTests((s) => s.select);
  const cleared = useTests((s) => s.cleared);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" data-testid="case-chips">
      {challenge.tests.map((test, index) => {
        const pass = results[index]?.status === "pass";
        const label = t(pass ? "result.chipPass" : "result.chipFail", {
          case: caseText(test.inputs),
        });
        // The chips of an accepted submission select nothing.
        if (cleared) {
          return (
            <span
              // oxlint-disable-next-line react/no-array-index-key -- a case is its index in the tests
              key={index}
              className="rounded-lg border border-taken/60 px-2.5 py-1 font-mono text-[0.8rem] text-taken"
              data-chip
            >
              {label}
            </span>
          );
        }
        return (
          <Button
            // oxlint-disable-next-line react/no-array-index-key -- a case is its index in the tests
            key={index}
            variant="outline"
            size="sm"
            aria-pressed={index === selected}
            className={cn(
              "font-mono",
              pass ? "border-taken/60 text-taken" : "border-destructive/60 text-destructive",
              index === selected && (pass ? "bg-taken/10" : "bg-destructive/10"),
            )}
            onClick={() => select(index)}
            data-chip
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

/** The selected case's rows, its first difference marked, or its error message. */
function SelectedRows({ challenge }: { challenge: Challenge }) {
  const selected = useTests((s) => s.selected);
  const result = useTests((s) => s.results[s.selected]);
  const outcome = useTests((s) => s.outcomes[s.selected]);
  const test = challenge.tests[selected];
  const rows = useMemo(
    () => resultRows(test?.expect, outcome ?? { stdout: [], vars: {} }),
    [test, outcome],
  );
  if (!test || !result) return null;
  return (
    <ResultRows
      rows={rows}
      marked={result.status === "fail" ? firstDifference(rows) : null}
      error={result.status === "error" ? errorText(result.error) : undefined}
      expected={test.expect.stdout !== undefined}
    />
  );
}

/** `Next problem →`, or `Plan complete` with `Back to Problems` after a plan's last. */
function Next({ id }: { id: string }) {
  const entries = useProgress((s) => s.entries);
  const next = nextProblem(id, (other) => statusOf(entries, other));
  if (next.kind === "complete") {
    return (
      <div className="flex items-center gap-3">
        <span className="font-semibold">{t("result.planComplete")}</span>
        <a href={routeHash({ page: "problems" })} className={buttonVariants()}>
          {t("result.backToProblems")}
        </a>
      </div>
    );
  }
  return (
    <Button onClick={() => navigate({ page: "problem", id: next.id })}>
      {t("result.nextProblem")}
    </Button>
  );
}

function Accepted({ challenge }: { challenge: Challenge }) {
  const first = useTests((s) => s.outcomes[0]);
  const setTab = useEditor((s) => s.setTab);
  const showSolution = useEditor((s) => s.showSolution);
  const solutionShown = useProgress((s) => s.solutionShown);
  // The chart stays the run's while running.
  const running = useRun((s) => s.status !== "idle");
  return (
    <>
      {first?.done.type === "done" && (
        <p className="font-mono text-xs" data-testid="steps-loops">
          {t("result.stepsLoops", { steps: first.done.steps, loops: first.done.loops })}
        </p>
      )}
      {challenge.takeaway && (
        <section>
          <h3 className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
            {t("result.whatYouUsed")}
          </h3>
          <Markdown text={localized(challenge.takeaway)} />
        </section>
      )}
      <div className="flex flex-col items-start gap-2 border-t pt-3">
        <Button variant="outline" onClick={() => setTab("python")}>
          {t("result.seePython")}
        </Button>
        <Button
          variant="outline"
          disabled={running}
          onClick={() => {
            showSolution(true);
            solutionShown(challenge.id);
          }}
        >
          {t("result.compare")}
        </Button>
        <Button variant="outline" onClick={() => openInPlayground(localized(challenge.title))}>
          {t("problem.openInPlayground")}
        </Button>
        <Next id={challenge.id} />
      </div>
    </>
  );
}

export function SubmissionView({ challenge }: { challenge: Challenge }) {
  const running = useTests((s) => s.running);
  const results = useTests((s) => s.results);
  const cleared = useTests((s) => s.cleared);
  const selected = useTests((s) => s.selected);
  const selectCase = useRun((s) => s.selectCase);
  if (running) {
    return <p className="text-muted-foreground">{t("result.submitting")}</p>;
  }
  const passed = results.filter((result) => result?.status === "pass").length;
  return (
    <div className="space-y-4" data-testid="submission">
      <h2
        className={cn("text-lg font-semibold", cleared ? "text-taken" : "text-destructive")}
        data-testid="verdict"
      >
        {t(cleared ? "result.accepted" : "result.wrong")}
      </h2>
      {!cleared && <p>{t("result.passedCount", { k: passed, n: challenge.tests.length })}</p>}
      <Chips challenge={challenge} />
      {cleared ? (
        <Accepted challenge={challenge} />
      ) : (
        <>
          <SelectedRows challenge={challenge} />
          <Button
            onClick={() => {
              selectCase(selected);
              startRun({ watch: true });
            }}
          >
            {t("result.watch")}
          </Button>
        </>
      )}
    </div>
  );
}
