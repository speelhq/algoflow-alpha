// The canvas: the solution band when the solution is shown, the path bar, the chart, while
// running the narration line, and the run bar. The Input nodes show the chosen case and list
// every case.
import { useCallback, useMemo } from "react";
import type { Challenge } from "@/challenges";
import { caseInputs } from "@/challenges/cases";
import { t } from "@/i18n/t";
import type { NodeId, Place, Program } from "@/lang/types";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useShallow } from "zustand/react/shallow";
import { useRun, type RunState } from "@/store/run";
import { Chart } from "@/ui/chart/Chart";
import type { Moves } from "@/ui/chart/drag";
import { layout, type ChartLayout } from "@/ui/chart/layout";
import { measureText, useFontLoads } from "@/ui/chart/measure";
import { paint, type Paint } from "@/ui/chart/paint";
import { PathBar } from "@/ui/chart/PathBar";
import { Connector } from "@/ui/editor/BlockMenu";
import { apply } from "@/ui/editor/edits";
import { accepts, tryMove } from "@/ui/editor/moves";
import { DiagnosticMessage, flaggedStatements, NodeEditor } from "@/ui/editor/NodeEditor";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";
import { narrate, narrateDifference, narrateEnd, type Narration } from "@/ui/run/narrate";
import { caseText } from "./caseText";
import { RunBar } from "./RunBar";

/** Replaces the learner's program with the solution, as one undoable edit. */
function loadSolution(challenge: Challenge): void {
  const program = useProgram.getState().program;
  const solution = structuredClone(challenge.solution);
  useProgram.getState().edit({ ...solution, challengeId: challenge.id, inputs: program.inputs });
  useEditor.getState().showSolution(false);
}

function SolutionBand({ challenge }: { challenge: Challenge }) {
  const showSolution = useEditor((s) => s.showSolution);
  return (
    <div
      className="flex h-11 shrink-0 items-center gap-2 border-b bg-attempted/15 px-4"
      data-testid="solution-band"
    >
      <span className="font-semibold">{t("chart.solution")}</span>
      <span className="text-muted-foreground">{t("chart.readOnly")}</span>
      <Button className="ml-auto" variant="outline" onClick={() => loadSolution(challenge)}>
        {t("chart.load")}
      </Button>
      <Button onClick={() => showSolution(false)}>{t("chart.backToMine")}</Button>
    </div>
  );
}

const say = (sentence: Narration) => t(sentence.key, sentence.params);

/** The driver fields the chart draws and narrates from. */
type Shown = Pick<
  RunState,
  | "status"
  | "step"
  | "total"
  | "outcome"
  | "lastEvent"
  | "state"
  | "frame"
  | "pass"
  | "difference"
  | "activeId"
  | "taken"
  | "verdicts"
  | "breakpoint"
>;

/** The sentence for the run's position, or none before the first step. */
function narration(run: Shown, program: Program): string | null {
  const { step, total, outcome, lastEvent, state, difference } = run;
  const end = outcome && step === total ? narrateEnd(outcome, total) : null;
  // An error is said wherever the run stops on it; a difference is said in place of the step.
  if (end && outcome?.type === "error") return say(end);
  if (difference && step === difference.step) return say(narrateDifference(difference));
  if (end) return say(end);
  if (!lastEvent || !state) return null;
  return say(narrate(lastEvent, { program, state, frame: run.frame, pass: run.pass }));
}

/** What the chart draws and says while running; in build mode the editor shows a diagnostic. */
function useRunPaint(
  chart: ChartLayout | null,
  program: Program,
): { paint?: Paint; narration: Narrated | null } {
  const run: Shown = useRun(
    useShallow((s) => ({
      status: s.status,
      step: s.step,
      total: s.total,
      outcome: s.outcome,
      lastEvent: s.lastEvent,
      state: s.state,
      frame: s.frame,
      pass: s.pass,
      difference: s.difference,
      activeId: s.activeId,
      taken: s.taken,
      verdicts: s.verdicts,
      breakpoint: s.breakpoint,
    })),
  );
  return useMemo(() => {
    if (!chart || run.status === "idle") return { narration: null };
    const painted = paint(chart, {
      ended: run.status === "done",
      activeId: run.activeId,
      lastEvent: run.lastEvent,
      taken: run.taken,
      verdicts: run.verdicts,
      breakpoint: run.breakpoint,
    });
    const text = narration(run, program);
    const error = run.status === "error" && run.step === run.total;
    return { paint: painted, narration: text === null ? null : { text, error } };
  }, [chart, run, program]);
}

/** The sentence of the run's position, and whether it is an error's message. */
type Narrated = { text: string; error: boolean };

/** The narration line between the chart and the run bar: one sentence, in one place. */
function NarrationLine({ narration }: { narration: Narrated | null }) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid={narration?.error ? "run-error" : "narration"}
      className={cn(
        "min-h-10 shrink-0 border-t bg-muted/30 px-4 py-2.5 text-[0.95rem]",
        narration?.error && "text-destructive",
      )}
    >
      {narration?.text}
    </p>
  );
}

export function Canvas({ challenge }: { challenge?: Challenge }) {
  const mine = useProgram((s) => s.program);
  const solution = useEditor((s) => s.solution);
  const selectedId = useEditor((s) => s.selectedId);
  const editing = useEditor((s) => s.editing);
  const hoveredId = useEditor((s) => s.hoveredId);
  const select = useEditor((s) => s.select);
  const caseIndex = useRun((s) => s.caseIndex);
  const selectCase = useRun((s) => s.selectCase);
  const running = useRun((s) => s.status !== "idle");
  const fonts = useFontLoads();
  const shown = solution && challenge !== undefined;
  const program: Program = shown ? challenge.solution : mine;
  // Until the page's effect loads the problem's program, the store holds the previous page's.
  const loaded = challenge === undefined || mine.challengeId === challenge.id;
  // The chosen case is the open program's; a challenge's solution declares the same inputs.
  const chart = useMemo(
    () =>
      fonts && loaded
        ? layout(program, { inputs: caseInputs(mine, caseIndex), measure: measureText })
        : null,
    [program, mine, caseIndex, fonts, loaded],
  );
  const cases = useMemo(
    () =>
      challenge && {
        labels: challenge.tests.map((test) => caseText(test.inputs)),
        choose: selectCase,
      },
    [challenge, selectCase],
  );
  const { paint: painted, narration: narrated } = useRunPaint(solution ? null : chart, mine);
  const empty = mine.main.length === 0;
  const flags = useMemo(() => {
    const flagged = flaggedStatements(mine);
    return {
      owners: new Set(flagged.keys()),
      card: (owner: NodeId) => (
        <div className="flex flex-col gap-2">
          {(flagged.get(owner) ?? []).map((diagnostic, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- diagnostics have no id of their own
            <DiagnosticMessage key={i} diagnostic={diagnostic} />
          ))}
        </div>
      ),
    };
  }, [mine]);
  const moves: Moves = useMemo(
    () => ({
      accepts: (owner, place) => accepts(useProgram.getState().program, owner, place),
      onMove: (owner, place) => {
        const result = tryMove(useProgram.getState().program, owner, place);
        if ("refused" in result) return result.refused;
        apply(() => result.program);
        return null;
      },
    }),
    [],
  );
  const connector = useCallback(
    ({ place }: { place: Place }) => (
      <Connector place={place} first={empty && place.parent === "main"} />
    ),
    [empty],
  );

  // In build mode a click selects; while running it sets or clears the breakpoint,
  // pausing first; once the run has ended it returns to build mode with the node selected.
  const onSelect = useCallback(
    (owner: NodeId, slot?: string, hole?: NodeId) => {
      const run = useRun.getState();
      if (run.status === "idle") return select(owner, slot, true, hole);
      if (run.status === "done" || run.status === "error") {
        run.stop();
        return select(owner);
      }
      if (run.status === "playing") run.pause();
      run.setBreakpoint(run.breakpoint === owner ? null : owner);
    },
    [select],
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col" data-testid="canvas" data-canvas>
      {shown && <SolutionBand challenge={challenge} />}
      <PathBar />
      {chart && (
        <Chart
          key={solution ? "solution" : "mine"}
          chart={chart}
          selectedId={solution || running ? null : selectedId}
          hoveredId={solution ? null : hoveredId}
          onSelect={solution ? undefined : onSelect}
          cases={solution || running ? undefined : cases}
          paint={painted}
          failed={narrated?.error ?? false}
          connector={solution || running ? undefined : connector}
          moves={solution || running ? undefined : moves}
          flags={solution || running ? undefined : flags}
          editor={
            solution || running || !selectedId || !editing ? undefined : (
              <NodeEditor id={selectedId} />
            )
          }
        />
      )}
      {running && !solution && <NarrationLine narration={narrated} />}
      <RunBar />
    </section>
  );
}
