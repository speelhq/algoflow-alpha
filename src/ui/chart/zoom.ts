// The chart fits its width on open, never above 100 %; `−` and `+` step by 1.25
// between 25 % and 200 %.
import { clamp } from "@/lib/utils";

const ZOOM = { min: 0.25, max: 2, step: 1.25 } as const;

/** The scale at which `width` fits `region`; 1 when it already fits. */
export function fitScale(region: number, width: number): number {
  if (!(region > 0) || !(width > 0)) return 1;
  return clamp(region / width, ZOOM.min, 1);
}

export function zoomStep(scale: number, direction: 1 | -1): number {
  const next = direction > 0 ? scale * ZOOM.step : scale / ZOOM.step;
  return clamp(next, ZOOM.min, ZOOM.max);
}
