// Playground programs: their ids and the index of their last saves under
// `algoflow:playground`. Each program itself is stored under its own program key.
import { newId } from "@/lang/id";
import { isRecord } from "@/lang/record";
import type { Program } from "@/lang/types";
import { readStored, removeStored, writeStored } from "./storage";

export const PLAYGROUND_KEY = "algoflow:playground";
const PLAYGROUND_PREFIX = "play-";

export type PlaygroundIndex = Record<string, { edited: number }>;
export type PlaygroundRow = { id: string; title: string; edited: number };

export function isPlaygroundId(id: string): boolean {
  return id.startsWith(PLAYGROUND_PREFIX);
}

export function newPlaygroundId(): string {
  return `${PLAYGROUND_PREFIX}${newId()}`;
}

/** The index as stored; malformed entries are dropped. */
export function readIndex(): PlaygroundIndex {
  return (
    readStored(PLAYGROUND_KEY, (stored) => {
      if (!isRecord(stored)) return undefined;
      const index: PlaygroundIndex = {};
      for (const [id, entry] of Object.entries(stored)) {
        if (isPlaygroundId(id) && isRecord(entry) && typeof entry.edited === "number") {
          index[id] = { edited: entry.edited };
        }
      }
      return index;
    }) ?? {}
  );
}

export function isListed(id: string): boolean {
  return Object.hasOwn(readIndex(), id);
}

/** Records a save of `id` at `now`. */
export function touch(id: string, now = Date.now()): void {
  writeStored(PLAYGROUND_KEY, { ...readIndex(), [id]: { edited: now } });
}

/** Removes a Playground program and its index entry. */
export function forget(id: string, programKey: string): void {
  const { [id]: _removed, ...rest } = readIndex();
  writeStored(PLAYGROUND_KEY, rest);
  removeStored(programKey);
}

/** The rows of the Playground page, the latest edit first; `title` reads each stored program. */
export function playgroundRows(title: (id: string) => string | undefined): PlaygroundRow[] {
  return Object.entries(readIndex())
    .map(([id, { edited }]) => ({ id, edited, title: title(id) }))
    .filter((row): row is PlaygroundRow => row.title !== undefined)
    .toSorted((a, b) => b.edited - a.edited);
}

/** A Playground program has no challenge and no inputs. */
export function asPlayground(program: Program): Program {
  const { challengeId: _ignored, ...rest } = program;
  return { ...rest, inputs: [] };
}
