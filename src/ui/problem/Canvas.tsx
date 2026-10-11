// The canvas: the solution band when the solution is shown, the path bar, the chart, while
// running the narration line, and the run bar. The Input nodes show the chosen case and list
// every case.
import { useCallback, useMemo } from "react";
import type { Challenge } from "@/challenges";
import { caseInputs } from "@/challenges/cases";
import { t } from "@/i18n/t";
import type { NodeId, Place, Program } from "@/lang/types";
import { useEditor } from "@/store/editor";
import { editable, inRun, useMode, type Mode } from "@/store/mode";
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
import { DiagnosticMessage, flaggedStatements } from "@/ui/editor/diagnostics";
import { NodeEditor } from "@/ui/editor/NodeEditor";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";
import { narratePosition } from "@/ui/run/narrate";
import { caseText } from "./caseText";
import { clickNode } from "./actions";
import { RunBar } from "./RunBar";

/** Leaves the solution and replaces the learner's program with it, as one undoable edit. */
function loadSolution(challenge: Challenge): void {
  useEditor.getState().showSolution(false);
  apply((program) => ({
    ...structuredClone(challenge.solution),
    challengeId: challenge.id,
    inputs: program.inputs,
  }));
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

/** What the chart draws and says in run mode; in build mode the editor shows a diagnostic. */
function useRunPaint(
  chart: ChartLayout | null,
  program: Program,
  mode: Mode,
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
    if (!chart || !inRun(mode)) return { narration: null };
    const painted = paint(chart, {
      finished: run.status === "done",
      activeId: run.activeId,
      lastEvent: run.lastEvent,
      taken: run.taken,
      verdicts: run.verdicts,
      breakpoint: run.breakpoint,
    });
    const told = narratePosition(run, program);
    const narration = told && {
      text: t(told.narration.key, told.narration.params),
      error: told.error,
    };
    return { paint: painted, narration };
  }, [chart, run, program, mode]);
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
  const selectedId = useEditor((s) => s.selectedId);
  const editing = useEditor((s) => s.editing);
  const hoveredId = useEditor((s) => s.hoveredId);
  const caseIndex = useRun((s) => s.caseIndex);
  const selectCase = useRun((s) => s.selectCase);
  const mode = useMode();
  const solution = mode === "solution";
  // The chart can be changed only in build mode; elsewhere it is drawn read-only.
  const readOnly = !editable(mode);
  const fonts = useFontLoads();
  const shown = solution && challenge !== undefined;
  const program: Program = shown ? challenge.solution : mine;
  // The chosen case is the open program's; a challenge's solution declares the same inputs.
  const chart = useMemo(
    () =>
      fonts ? layout(program, { inputs: caseInputs(mine, caseIndex), measure: measureText }) : null,
    [program, mine, caseIndex, fonts],
  );
  const cases = useMemo(
    () =>
      challenge && {
        labels: challenge.tests.map((test) => caseText(test.inputs)),
        choose: selectCase,
      },
    [challenge, selectCase],
  );
  const { paint: painted, narration: narrated } = useRunPaint(chart, mine, mode);
  const empty = mine.main.length === 0;
  const flags = useMemo(() => {
    const flagged = flaggedStatements(mine);
    return {
      owners: new Set(flagged.keys()),
      // oxlint-disable-next-line react/no-unstable-nested-components -- a render function, not a component
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

  return (
    <section className="flex min-w-0 flex-1 flex-col" data-testid="canvas" data-canvas>
      {shown && <SolutionBand challenge={challenge} />}
      <PathBar />
      {chart && (
        <Chart
          key={solution ? "solution" : "mine"}
          chart={chart}
          selectedId={readOnly ? null : selectedId}
          hoveredId={solution ? null : hoveredId}
          onSelect={clickNode}
          cases={readOnly ? undefined : cases}
          paint={painted}
          failed={narrated?.error ?? false}
          connector={readOnly ? undefined : connector}
          moves={readOnly ? undefined : moves}
          flags={readOnly ? undefined : flags}
          editor={readOnly || !selectedId || !editing ? undefined : <NodeEditor id={selectedId} />}
        />
      )}
      {inRun(mode) && <NarrationLine narration={narrated} />}
      <RunBar />
    </section>
  );
}
