// The run bar at the foot of the canvas: `▶ Run` in build mode; while running one play
// button in its place (`Pause`, `Play`, or `Replay` at the last step), Back, Step, Skip,
// the position bar `step k of N`, which seeks to any step, the three speeds, and Stop. A
// pre-run that hit the step limit is reported above it.
import { formatNumber, t } from "@/i18n/t";
import { STEP_LIMIT } from "@/runtime/run";
import { SPEED_NAMES, SPEEDS, useLayout } from "@/store/layout";
import { inRun, useMode } from "@/store/mode";
import { useRun } from "@/store/run";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/primitives/button";
import { Slider } from "@/ui/primitives/slider";
import { togglePlay } from "./actions";

function first(value: number | readonly number[]): number {
  return typeof value === "number" ? value : (value[0] ?? 0);
}

const PLAY_LABEL = {
  idle: "run.run",
  playing: "run.pause",
  paused: "run.play",
  done: "run.replay",
  error: "run.replay",
} as const;

/** `Run`, or while running the button that makes the run go on or stop. */
function PlayButton() {
  const status = useRun((s) => s.status);
  const busy = useRun((s) => s.busy);
  // While the pre-run or a Seek works, the run cannot start or go on yet.
  const waiting = busy && (status === "idle" || status === "paused");
  return (
    <Button className="w-28" disabled={waiting} onClick={togglePlay}>
      {t(PLAY_LABEL[status])}
    </Button>
  );
}

function Speed() {
  const speed = useLayout((s) => s.speed);
  const setSpeed = useLayout((s) => s.setSpeed);
  return (
    <div
      className="flex items-center rounded-md border p-0.5"
      role="group"
      aria-label={t("run.speed")}
    >
      {SPEED_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={speed === SPEEDS[name]}
          data-speed={name}
          className={cn(
            "rounded px-2 py-1 text-sm",
            speed === SPEEDS[name] ? "bg-foreground text-background" : "hover:bg-muted",
          )}
          onClick={() => setSpeed(SPEEDS[name])}
        >
          {t(`run.speeds.${name}`)}
        </button>
      ))}
    </div>
  );
}

export function RunBar() {
  const step = useRun((s) => s.step);
  const total = useRun((s) => s.total);
  const outcome = useRun((s) => s.outcome);
  const back = useRun((s) => s.back);
  const stepOnce = useRun((s) => s.stepOnce);
  const skip = useRun((s) => s.skip);
  const seek = useRun((s) => s.seek);
  const stop = useRun((s) => s.stop);
  const mode = useMode();
  const runMode = inRun(mode);
  const ended = mode === "ended";
  const endless = outcome?.type === "error" && outcome.error.code === "E_STEP_LIMIT";

  return (
    <div className="shrink-0 border-t bg-background" data-testid="run-bar">
      {runMode && endless && (
        <p
          role="alert"
          className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
          data-testid="endless"
        >
          {t("run.endless", { limit: formatNumber(STEP_LIMIT) })}
        </p>
      )}
      <div className="flex h-14 items-center gap-2 px-4">
        <PlayButton />
        {runMode && (
          <>
            <Button variant="outline" disabled={step === 0} onClick={() => void back()}>
              {t("run.back")}
            </Button>
            <Button variant="outline" disabled={ended} onClick={stepOnce}>
              {t("run.step")}
            </Button>
            <Button variant="outline" disabled={ended} onClick={() => void skip()}>
              {t("run.skip")}
            </Button>
            <Slider
              className="mx-3 min-w-24 flex-1"
              min={0}
              max={total}
              value={[step]}
              onValueChange={(value) => void seek(first(value))}
              aria-label={t("run.positionLabel")}
              data-testid="position"
            />
            <span className="font-mono text-sm whitespace-nowrap" data-testid="position-text">
              {t("run.position", { k: step, n: total })}
            </span>
            <Speed />
            <Button variant="outline" onClick={stop}>
              {t("run.stop")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
