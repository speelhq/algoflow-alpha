// Mulberry32 seeded per run; every result is recorded so that CPython can replay it.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Random = {
  int(a: number, b: number): number; // inclusive
  draws(): number[];
};

export function createRandom(seed: number): Random {
  const next = mulberry32(seed);
  const draws: number[] = [];
  return {
    int(a, b) {
      const value = a + Math.floor(next() * (b - a + 1));
      draws.push(value);
      return value;
    },
    draws: () => [...draws],
  };
}
