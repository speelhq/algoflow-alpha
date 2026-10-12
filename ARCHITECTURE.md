# Architecture

AlgoFlow is a block-based algorithm learning tool that runs entirely in the
browser (`docs/spec/scope/`). Its blocks are a fixed Python subset; functions and classes
can be moved into modules and reused across programs (`docs/spec/modules/`).

## Fixed choices

- TypeScript 7 (its Go compiler is the `tsc` binary), Oxlint with
  `oxlint-tsgolint`, and Oxfmt; never ESLint, Prettier, or a TypeScript
  earlier than 7.
- shadcn/ui on Base UI (not Radix), dnd-kit, and Zustand.
- No graph, flow, or editor library: the chart is laid out from the
  `Program` by the application and never positioned by hand (`docs/spec/ui/chart.md`), which
  leaves nothing for a library of freely placed nodes and edges to do.
- `src/lang`, `src/runtime`, `src/python`, and `src/nodes` import only each
  other: through `@/` across folders and `./` within one, never `../`; tests
  may add `vitest` and `@/i18n` (`.oxlintrc.json`).
- One block per file in `src/nodes/`; nothing else branches on block kind
  or name (`docs/spec/nodes/`): every consumer reads a block's
  declarations, so a block added later works in the menu, the chart, and
  the editor with no other change.
- Every user-visible string comes from `src/i18n/en.json`, so Japanese is
  one more catalog of the same keys.
- `int` and `float` are distinct values; lists, dicts, and objects reside
  on the heap (`docs/spec/language/`).

## Code map

Data flows one way, and nothing below `src/store` depends on React, so the
core runs under Vitest and in `scripts/check.ts` without a browser.

- `src/lang` — the `Program` AST (`types.ts`), `validate()` → `Diagnostic[]`
  run after every edit and before every run, pure edit functions returning a
  new `Program` (`edit.ts`), and `Data` ⇄ `Value`/heap conversion
  (`data.ts`). A `Program` is never mutated in place: `validate()`,
  `firstAssignments()`, and `nodesById()` are memoized per `Program` object,
  and the undo history holds earlier programs.
- `src/nodes` — one `NodeDef` per block owning its slots, `create()`, `run`
  (interpreter behaviour), `python()` (exact emitted text), and `chart`
  (`docs/spec/nodes/`). `registry.ts` is the only registry; the interpreter,
  the emitter, the chart, the block menu, and the node editor dispatch
  through it.
- `src/runtime` — `run()` returns a `Runner` whose `next()` yields one
  event, or `Done` at the end (`docs/spec/runtime/interpreter.md`). Events
  are the contract the UI consumes for highlights and step counts, and a run
  is deterministic.
- `src/python` — `emit()` produces the Python file plus a NodeId → line map;
  `parse()` turns typed expression text back into `Expr`; `unparse(parse(s))`
  is a fixed point (`docs/spec/runtime/parser.md`). Emitted Python is the behavioural reference, not
  the interpreter.
- `src/challenges` — the schema types (`types.ts`), the bundled challenges
  and plans (`index.ts`, `plans.ts`), the judge shared with
  `scripts/check.ts` (`judge.ts`), the `Result` rows (`rows.ts`), and a
  plan's button and the next problem (`next.ts`).
- `src/store` — Zustand stores: `program` (the open program, its undo
  history, and its persistence), `playground` (the Playground programs'
  index), `editor` (the hovered and the selected node), `run` (the
  pre-running, timer-driven driver), `tests` (submission verdicts), `progress`
  (per-problem status under `algoflow:progress`), and `layout` (panel width,
  collapse, and playback speed under `algoflow:layout`); `mode.ts` derives
  the page's mode (build, solution, running, ended) from `run` and `editor`,
  and every check of what the page allows reads it; `batches.ts` is the one
  loop that works through a run in batches; `open.ts` is the one way a
  page's program is opened; `storage.ts` holds every read and write
  of `localStorage`.
- `src/ui/primitives` — shadcn components generated on Base UI, regenerated
  as `.claude/rules/ui.md` states; `src/lib/utils.ts` holds `cn()` and `clamp()`.
- `src/ui/app` — the page shell. Routes are parsed by hand (`route.ts`): four
  hash routes with at most one parameter are one function and one
  `hashchange` listener, read through `useSyncExternalStore`; a router
  would bring nested layouts, loaders, and history modes that a
  hash-addressed single page does not use. The listener opens a route's
  program before it tells React, so a page never draws with the program of
  the page before. The panel's resize handle is `ResizeHandle.tsx`, as
  `react-resizable-panels` works in percentages where the spec states
  pixels.
- `src/ui` — React. The chart is an SVG flowchart with computed layout
  (`src/ui/chart/layout.ts`); node text and narration are plain
  strings from `src/ui/chart/text.ts` and `src/ui/run/narrate.ts`, and
  `text.ts` holds the one reading of a template; the node editor's state is
  a session that changes only through pure steps
  (`src/ui/editor/session.ts`); variable views are chosen by value type only
  (`docs/spec/ui/views.md`), never by block or challenge.
- `challenges/<id>.json` — one file per challenge, checked by
  `scripts/check.ts`, which runs every solution in the interpreter and in
  CPython and compares both (`docs/spec/challenges/`).
