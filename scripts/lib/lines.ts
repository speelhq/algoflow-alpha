// Line numbers of offsets into a text, for the checks that report `file:line`.

/** The offsets where the lines of `text` start. */
export function lineStarts(text: string): number[] {
  return [0, ...[...text.matchAll(/\n/g)].map((m) => m.index + 1)];
}

/** The 1-based line of an offset, given the offsets where the lines start. */
export function lineOf(starts: readonly number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((starts[mid] ?? 0) <= offset) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}
