# Challenges

Code: `challenges/*.json`, `challenges/plans.json`, `src/challenges/`, and
`scripts/check.ts` with `scripts/lib/challenge.ts`, `plans.ts`,
`interp.ts`, and `agreement.ts`. Tests: beside each file.

## Schema

Each challenge is one file `challenges/<id>.json`:

```ts
export type Challenge = {
  id: string; // file name without .json
  title: Localized;
  difficulty: "easy" | "medium" | "hard";
  topics: Topic[]; // ≥ 1, from the topic list (`pages.md`, Problems page)
  description: Localized; // markdown
  inputs: InputDecl[]; // language.md
  tests: Test[]; // ≥ 3
  hints: Localized[]; // exactly 3 (Hints)
  takeaway?: Localized; // one sentence shown as `What you used` (`run.md`, Submission)
  module?: Id; // Modules and definitions
  defines?: Id[]; // Modules and definitions
  solution: Program; // inputs identical to `inputs`
};
export type Test = {
  inputs: Record<Id, Data>; // every input, a value of its kind (`language.md`, Kinds); shown by these values
  edge?: boolean; // Checks
  seed?: number; // default 1
  expect: { variables?: Record<Id, Data>; stdout?: string[] }; // ≥ 1
};
export type Localized = { en: string; ja?: string }; // ja: Checks
export type Topic = "output" | "variables" | "loops" | "conditions" | "lists" | "searching"
  | "sorting" | "recursion" | "dictionaries" | "classes";
```

## Checks

For every challenge `scripts/check.ts` checks the schema, the `edge`, `ja`,
and input-value rules below, validates (`language.md`) `solution` with the
built-in modules (`modules.md`, Built-in modules), and runs it on every test in the
interpreter against `expect` (Judging). What the hints name, in their order
(Hints), is reviewed, not checked. The check, not `validate()`, checks input
names: an input has no NodeId to attach a diagnostic to, and no edit
changes it.

Every challenge has at least one test with `edge: true`, a boundary case
such as an empty list, zero, or a single item. It is a flag, not a name
beginning with `edge:`: a test has no shown name (cases are shown by their
inputs), and a name would need a Japanese text.

Every value of a test's `inputs` is one the blocks write: its Python text
(`emitter.md`) parses (`parser.md`), so that `Open in Playground` makes it
an assignment (`pages.md`, Help and `⋯`).

Every `Localized` text of a challenge, a plan, and a built-in module has its
`ja` text (`scope.md`, Product).

Every challenge is in exactly one plan, once: `scripts/check.ts` fails on a
plan member with no challenge file, a member listed twice, a challenge in
two plans, and a challenge in no plan. A problem in no plan would need a
section, an order, and a `Next problem` rule of its own; a problem no plan
takes yet waits as a `challenge` issue.

`plans.json` lists a plan once the file of its first member in `scope.md`,
Curriculum, exists, with the members whose files exist, in that order;
`scripts/check.ts` rejects a plan with no problems, which would draw an
inert card (`0 of 0 solved`, `Start` with no destination). Membership and
order are not checked against the curriculum by code: its table copied into
`scripts/` would be a second copy, and `plans.json` as the authority would
take the curriculum out of the spec.

## Modules and definitions

`module` names the learner module the challenge's functions and classes
belong to; the Accepted card then offers `Move to module <name>` (`run.md`,
Submission).

`defines` lists names the submission must define in the program or in a
learner module; a name resolving to a built-in module is refused (`run.md`,
Submission), and `scripts/check.ts` requires `solution` to define every
listed name itself. The built-in module lets a learner who skipped a
problem start anywhere with blocks that stay inspectable, but in a problem
that asks for the definition it would pass without anything being built.

## Hints

The three hints name, in order, the block or module function to use, the
shape of the loop or condition, and the remaining step, so a learner without
an instructor can complete the problem after the third hint.

## Study plans

`challenges/plans.json` lists the study plans in display order:

```ts
export type Plan = {
  id: string; // unique among the plans
  title: Localized;
  description: Localized; // one line
  problems: string[]; // challenge ids, in order
};
```

The plans and their members are those of `scope.md`, Curriculum.

## Progress

Progress persists under `localStorage` `algoflow:progress` as
`Record<id, { status: "attempted" | "solved"; hints: number; solution: boolean }>`:
an entry appears on the first submission, hint, or shown solution, `solved`
is set by an accepted submission and never cleared, `hints` is the number of
hints revealed (`pages.md`, Problem tab), and `solution` whether the
solution was shown (same). A shown solution makes the problem `attempted`,
as a hint does: both used it. Step counts are not stored to compare
problems: that would infer a relation between problems and store one more
field.

A tab that records progress writes the stored record joined with its own,
entry by entry: every entry of either, `solved` over `attempted`, the larger
`hints`, and `solution` once either holds it.

A tab reads `algoflow:progress` again on the window's `storage` event for
that key and joins it with its own record. Writing back the record a tab
read at load would erase what another tab recorded since, a solved problem
included; every field only grows, so a join loses nothing and needs no time
stamp, while the `storage` event alone would still lose an entry written
before it arrives.

## Judging

A test passes when every `expect.variables` entry equals the final
main-level variable and `expect.stdout` equals `stdout()` line by line.
Equality: ints exactly; floats within absolute 1e-6; strings, booleans,
none exactly; lists element-wise; dicts by key set and values; objects by
class, field set, and field values, identity ignored.

A runtime error fails the test and is shown in its row.

An accepted submission requires every test to pass.

Run (`run.md`, Run bar) drives one runner with the inputs of the chosen case
(`chart.md`, Input nodes) and judges that case at the end of the run
(`pages.md`, Result tab); Submit (`run.md`, Submission) judges every test on
its own runner in batches (`interpreter.md`, Driver) without affecting the
driver; both use the modules the program uses (`modules.md`, Resolution),
and every verdict comes from `src/challenges/judge.ts`, the rule
`scripts/check.ts` applies. Submit has runners of its own because judging
through the driver would discard the learner's position.

## Opening and bundling

Opening a problem restores its program from `localStorage` (`language.md`,
Storage) or creates one with an empty `main`, with `challengeId` and
`inputs` set; opening discards any runner (`interpreter.md`, Controls)
and selects the first test's inputs for the Input nodes (`chart.md`, Input
nodes).

The browser bundles `challenges/*.json` and `plans.json` at build time
(`import.meta.glob` in `src/challenges/index.ts`); `scripts/check.ts` reads
the files from disk. The schema types live in `src/challenges/types.ts`.

## Course plan (`course`)

Inputs are `name: default`. Expectations are `expect.variables` unless
`stdout` is stated. In the `edge tests` columns an entry written `edge: …`
is a test with `edge: true`, and the text following it is descriptive only.

| id             | difficulty, topics          | inputs                                 | expectation                                  | edge tests                                            |
| -------------- | --------------------------- | -------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| tutorial       | easy, output                | `name: "Claude"`                       | stdout `Hello, Claude`                       | `edge: empty` `""` → `Hello, `                        |
| sum-to-n       | easy, loops variables       | `n: 10`                                | `total = 55`                                 | `edge: 0` → `0`; `1` → `1`                            |
| fizzbuzz       | easy, loops conditions      | `n: 15`                                | stdout 1..n with `Fizz`, `Buzz`, `FizzBuzz`  | `edge: 1`; `3`                                        |
| max-of-three   | easy, conditions            | `a: 3, b: 9, c: 5`                     | `biggest = 9`                                | `edge: equal` `3,3,3`; negatives                      |
| countdown      | easy, loops                 | `n: 5`                                 | stdout `5` … `0`, one per line, with `while` | `edge: 0` → `0`                                       |
| list-max       | easy, lists                 | `nums: [4, 9, 2, 7]`                   | `biggest = 9`                                | `edge: one` `[7]`; `[-3, -1, -2]` → `-1`              |
| count-evens    | easy, lists conditions      | `nums: [1, 2, 3, 4, 6]`                | `count = 3`                                  | `edge: empty` → `0`; no evens                         |
| linear-search  | easy, lists searching       | `nums: [4, 9, 2, 7], target: 2`        | `found = 2`                                  | `edge: missing` → `-1`; first of duplicates           |
| binary-search  | medium, lists searching     | `nums: [1, 3, 5, 7, 9, 11], target: 7` | `found = 3`, `nums` unchanged                | `edge: missing` → `-1`; `edge: empty`; first and last |
| bubble-sort    | medium, lists sorting       | `nums: [5, 3, 1, 4, 2]`                | `nums = [1, 2, 3, 4, 5]`                     | `edge: empty`; `edge: one`; `[2, 2, 1]`; sorted       |
| selection-sort | medium, lists sorting       | same                                   | same                                         | same                                                  |
| insertion-sort | medium, lists sorting       | same                                   | same                                         | same                                                  |
| reverse-list   | easy, lists                 | `nums: [1, 2, 3, 4]`                   | `nums = [4, 3, 2, 1]` in place with `swap`   | `edge: empty`; `edge: one`; odd length                |

The tutorial prints two values, `print("Hello,", name)`, not
`"Hello, " + name`, which would make its first action combine a text, an
operator, and a variable before any problem introduces operators.

## Data-structure plan (`structures`)

Heap items are compared with `<`; a list item is compared by its item 0
(`modules.md`, Built-in modules). `heap-push` and `heap-pop` carry
`module: heap`; the later problems call `heap_push` and `heap_pop` from the
learner's `heap` module or the built-in one (`language.md`, Scope).

| id             | difficulty, topics      | inputs                                            | expectation                                                                                                              | edge tests                                              |
| -------------- | ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| stack-balance  | medium, lists           | `text: "([]{})"`                                  | `ok = True` with a list as stack                                                                                         | `edge: empty` → `True`; `"(]"`; `"(("`                  |
| bfs-grid       | hard, lists searching   | `grid: 5×5 of 0/1, start: [0, 0], goal: [4, 4]`   | `dist = 8`, table `seen`; frontier list used as a queue; `deltas = [[0,1],[1,0],[0,-1],[-1,0]]`                          | `edge: unreachable` → `-1`; start = goal → `0`          |
| heap-push      | medium, lists           | `heap: [], items: [5, 3, 8, 1]`                   | `heap = [1, 3, 8, 5]` after `heap_push(heap, x)` for each item: append, then sift up with `swap`; `defines: [heap_push]` | `edge: empty` items → `[]`; one item                    |
| heap-pop       | medium, lists           | `heap: [1, 3, 8, 5]`                              | `out = 1`, `heap = [3, 5, 8]` via `heap_pop(heap)`: root out, last item to the root, sift down; `defines: [heap_pop]`    | `edge: one` → `heap = []`; `edge: two` `[2, 9]`; `[1, 1, 2]` |
| dijkstra-grid  | hard, lists searching   | `cost: 5×5 ints, start, goal`                     | `total`; frontier list, minimum removed by a program function `pop_min(frontier)`                                        | `edge: 1×1`; uniform costs                              |
| dijkstra-heap  | hard, lists searching   | as dijkstra-grid                                  | same `total`; the frontier is a heap of `[d, r, c]` kept with `heap_push` and `heap_pop`                                 | as dijkstra-grid                                        |
| astar-grid     | hard, lists searching   | as bfs                                            | `dist = 8`, `expanded` ≤ bfs; the frontier is a heap of `[f, r, c]` with `abs(r - gr) + abs(c - gc)` inline               | as bfs                                                  |

## Dynamic-programming plan (`dp`)

| id          | difficulty, topics | inputs                                             | expectation                                | edge tests                                    |
| ----------- | ------------------ | -------------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| coin-change | hard, lists loops  | `coins: [1, 2, 5], amount: 11`                     | `best = 3`, list `dp` of length 12         | `edge: 0` → `0`; `coins [2], amount 3` → `-1` |
| knapsack    | hard, lists loops  | `weights: [1, 3, 4], values: [15, 20, 30], cap: 4` | `best = 35`, table `dp`                    | `edge: cap 0` → `0`                           |
| lcs         | hard, lists loops  | `s: "ABCBDAB", t: "BDCABA"`                        | `length = 4`, table `dp` 8 × 7             | `edge: empty` → `0`                           |

## Verification

`pnpm check` passes: every challenge, every test in both engines, the plans,
and the built-in modules (`modules.md`, Built-in modules).
