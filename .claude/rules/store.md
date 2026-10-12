---
paths:
  - "src/store/**"
---

# The stores

Before changing a store, read the spec it implements: `docs/spec/runtime/interpreter.md`,
Driver, for `run.ts` and `batches.ts`; `docs/spec/language/language.md`, Edits and Storage,
for `program.ts` and `playground.ts`; `docs/spec/challenges/challenges.md`, Progress and
Judging, for `progress.ts` and `tests.ts`; `docs/spec/ui/pages.md` for `layout.ts`.

- A store's state type declares its actions as function properties (`seek: (step) => …`),
  never as method signatures (oxlint's `unbound-method`).
- Vitest fake timers give a timeout created during a tick a delay of 1 ms, so a batch loop
  needs `advanceTimersByTimeAsync(1)` per batch (`settle()` in `src/store/testing.ts`).
- A store that persists is tested under `// @vitest-environment jsdom`.
