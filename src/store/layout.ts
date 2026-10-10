// The problem panel's width and collapsed state and the playback speed (one of three)
// persist to localStorage under `algoflow:layout`. Values are clamped on write and validated again when read
// back, so storage never yields an out-of-range width or a non-boolean flag.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isRecord } from "@/lang/record";
import { persistStorage } from "./storage";

export const LAYOUT_STORAGE_KEY = "algoflow:layout";

/** 320 px by default, resizable from 280 px to half the viewport width. */
export const PANEL = { default: 320, min: 280, viewportShare: 0.5 } as const;

/** The three speeds, in steps per second while playing; `Normal` until the learner chooses. */
export const SPEEDS = { slow: 1, normal: 4, fast: 15 } as const;
export type SpeedName = keyof typeof SPEEDS;
export const SPEED_NAMES = Object.keys(SPEEDS) as SpeedName[];

/** A stored or requested speed as one of the three: the nearest, else `Normal`. */
function speedOf(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const speeds = Object.values(SPEEDS) as number[];
  return speeds.reduce((best, speed) =>
    Math.abs(speed - value) < Math.abs(best - value) ? speed : best,
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The width at which the panel is drawn and to which it is set: `panel` bounded by
 * 280 px and half of `viewport`. The lower bound prevails in a viewport narrower than 560 px.
 */
export function panelWidth(panel: number, viewport: number): number {
  const max = Math.max(PANEL.min, Math.floor(viewport * PANEL.viewportShare));
  return clamp(Math.round(panel), PANEL.min, max);
}

export type LayoutState = {
  /** The requested width, bounded below only; draw it through `panelWidth()`. */
  panel: number;
  collapsed: boolean;
  speed: number;
  /** `viewport` is the viewport width in px (`window.innerWidth` where the handle is dragged). */
  setPanel: (px: number, viewport: number) => void;
  setCollapsed: (collapsed: boolean) => void;
  setSpeed: (speed: number) => void;
};

/** A finite number rounded and clamped, else `fallback`: what a setter and a stored value both pass. */
function size(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), min, max)
    : fallback;
}

type Persisted = Pick<LayoutState, "panel" | "collapsed" | "speed">;

/** A snapshot's fields, each validated; unknown or malformed fields fall back to defaults. */
function readLayout(persisted: unknown): Persisted {
  const stored = isRecord(persisted) ? persisted : {};
  return {
    panel: size(stored.panel, PANEL.default, PANEL.min, Number.MAX_SAFE_INTEGER),
    collapsed: typeof stored.collapsed === "boolean" ? stored.collapsed : false,
    speed: speedOf(stored.speed, SPEEDS.normal),
  };
}

/** Validates a persisted snapshot; unknown or malformed fields fall back to defaults. */
export function mergePersisted(persisted: unknown, current: LayoutState): LayoutState {
  return { ...current, ...readLayout(persisted) };
}

/** The key holds the record itself, with no wrapper and no version. */
const storage = persistStorage<Persisted>(readLayout, (state) => state);

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      panel: PANEL.default,
      collapsed: false,
      speed: SPEEDS.normal,
      setPanel: (px, viewport) =>
        set((s) =>
          Number.isFinite(px) && Number.isFinite(viewport)
            ? { panel: panelWidth(px, viewport) }
            : { panel: s.panel },
        ),
      setCollapsed: (collapsed) => set({ collapsed }),
      setSpeed: (speed) => set((s) => ({ speed: speedOf(speed, s.speed) })),
    }),
    {
      name: LAYOUT_STORAGE_KEY,
      storage,
      partialize: ({ panel, collapsed, speed }) => ({ panel, collapsed, speed }),
      merge: mergePersisted,
    },
  ),
);
