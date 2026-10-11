// Text widths for `layout()`, measured with the font the chart draws in. Widths depend
// on the loaded font, so the cache is cleared each time fonts finish loading.
import { useSyncExternalStore } from "react";
import { estimatedWidth, type Measure } from "./layout";

export const CHART_FONT = '13px "Geist Variable", sans-serif';
/** A variable's name is drawn bold. */
const CHART_FONT_BOLD = `600 ${CHART_FONT}`;

let context: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
/** Bumped whenever fonts finish loading: widths measured before then are stale. */
let loads = 0;
const listeners = new Set<() => void>();

function fontsLoaded(): void {
  loads += 1;
  widths.clear();
  for (const listener of listeners) listener();
}

if (typeof document !== "undefined") {
  document.fonts.addEventListener("loadingdone", fontsLoaded);
  void document.fonts.ready.then(fontsLoaded);
}

export const measureText: Measure = (text, shape, bold = false) => {
  const key = bold ? `b:${text}` : text;
  const known = widths.get(key);
  if (known !== undefined) return known;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return estimatedWidth(text, shape, bold);
  context.font = bold ? CHART_FONT_BOLD : CHART_FONT;
  const width = context.measureText(text).width;
  widths.set(key, width);
  return width;
};

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Changes each time fonts finish loading, so a layout measured before then is redone. */
export function useFontLoads(): number {
  return useSyncExternalStore(subscribe, () => loads);
}
