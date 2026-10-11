// Per-problem progress under `algoflow:progress`. An entry appears on the first
// submission, hint, or shown solution; `solved` is never cleared. The stored value is the
// bare record, validated when read back, so storage never yields a malformed entry. Every
// write joins the stored record, and another tab's write is joined when its `storage` event
// arrives, so no tab removes what another recorded.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isRecord } from "@/lang/record";
import { clamp } from "@/lib/utils";
import { persistStorage, readStored } from "./storage";

export const PROGRESS_STORAGE_KEY = "algoflow:progress";

/** A challenge has exactly three hints. */
export const HINTS = 3;

export type ProgressStatus = "attempted" | "solved";
export type ProgressEntry = { status: ProgressStatus; hints: number; solution: boolean };
export type Progress = Record<string, ProgressEntry>;

export type ProgressState = {
  entries: Progress;
  /** Records a submission; an accepted one makes the problem solved. */
  submitted: (id: string, accepted: boolean) => void;
  /** Records that `count` hints are revealed; the number never goes down. */
  hintShown: (id: string, count: number) => void;
  solutionShown: (id: string) => void;
};

/** The entry that records nothing: joined with any entry, it leaves that entry. */
const FRESH: ProgressEntry = { status: "attempted", hints: 0, solution: false };

/** The status mark of a problem row; undefined while untouched. */
export function statusOf(entries: Progress, id: string): ProgressStatus | undefined {
  return Object.hasOwn(entries, id) ? entries[id]?.status : undefined;
}

/** `n of m solved`. */
export function solvedCount(entries: Progress, ids: readonly string[]): number {
  return ids.filter((id) => statusOf(entries, id) === "solved").length;
}

function entryOf(value: unknown): ProgressEntry | undefined {
  if (!isRecord(value)) return undefined;
  if (value.status !== "attempted" && value.status !== "solved") return undefined;
  const hints = typeof value.hints === "number" && Number.isFinite(value.hints) ? value.hints : 0;
  return {
    status: value.status,
    hints: clamp(Math.round(hints), 0, HINTS),
    solution: value.solution === true,
  };
}

/** Validates a stored record; malformed entries are dropped. */
export function readProgress(stored: unknown): Progress {
  const entries: Progress = {};
  if (!isRecord(stored)) return entries;
  for (const [id, value] of Object.entries(stored)) {
    const entry = entryOf(value);
    if (entry) entries[id] = entry;
  }
  return entries;
}

function joinEntry(a: ProgressEntry, b: ProgressEntry): ProgressEntry {
  return {
    status: a.status === "solved" || b.status === "solved" ? "solved" : "attempted",
    hints: Math.max(a.hints, b.hints),
    solution: a.solution || b.solution,
  };
}

/**
 * Two records as one: every entry of either, `solved` over `attempted`, the larger `hints`,
 * and `solution` once either holds it. Every field only grows, so the join loses nothing.
 */
function joinProgress(a: Progress, b: Progress): Progress {
  const joined: Progress = { ...a };
  for (const [id, entry] of Object.entries(b)) {
    const held = Object.hasOwn(joined, id) ? joined[id] : undefined;
    joined[id] = held ? joinEntry(held, entry) : entry;
  }
  return joined;
}

type Persisted = { entries: Progress };

/** The key holds `Record<id, entry>` itself, with no wrapper around it. */
const storage = persistStorage<Persisted>(
  (stored) => ({ entries: readProgress(stored) }),
  (state) => state.entries,
);

export const useProgress = create<ProgressState>()(
  persist(
    (set) => {
      /** Joins `entry` with the stored record, which another tab may have written, and this tab's. */
      const record = (id: string, entry: ProgressEntry) =>
        set((state) => ({
          entries: joinProgress(
            joinProgress(readStored(PROGRESS_STORAGE_KEY, readProgress) ?? {}, state.entries),
            { [id]: entry },
          ),
        }));
      return {
        entries: {},
        submitted: (id, accepted) =>
          record(id, { ...FRESH, status: accepted ? "solved" : "attempted" }),
        hintShown: (id, count) =>
          record(id, { ...FRESH, hints: clamp(Math.round(count), 0, HINTS) }),
        solutionShown: (id) => record(id, { ...FRESH, solution: true }),
      };
    },
    {
      name: PROGRESS_STORAGE_KEY,
      storage,
      partialize: ({ entries }) => ({ entries }),
      merge: (persisted, current) => ({
        ...current,
        entries: joinProgress(
          readProgress(isRecord(persisted) ? persisted.entries : undefined),
          current.entries,
        ),
      }),
    },
  ),
);

// Another tab's write arrives as a `storage` event; rehydrating joins it and writes nothing.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === PROGRESS_STORAGE_KEY) void useProgress.persist.rehydrate();
  });
}
