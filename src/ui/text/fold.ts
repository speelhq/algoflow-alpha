// An `Example` output of more than eight lines folds to its first five and `… n more`.
const FOLD = { over: 8, keep: 5 } as const;

export function foldLines<T>(lines: readonly T[]): { shown: T[]; more: number } {
  return lines.length > FOLD.over
    ? { shown: lines.slice(0, FOLD.keep), more: lines.length - FOLD.keep }
    : { shown: [...lines], more: 0 };
}
