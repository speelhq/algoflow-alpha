# Views

Code: the variables of the `Result` tab (`src/ui/problem/ResultTab.tsx`),
the view choice persisted through `src/store/storage.ts`. Tests: the
screenshots of `pages.md`, Verification.

The `Result` tab chooses one view per variable by value:

| Value                       | View                                       |
| --------------------------- | ------------------------------------------ |
| int, float, str, bool, none | inline text                                |
| list of lists ≤ 30 × 30     | grid                                       |
| list of ≤ 40 values         | cards, each value as inline text           |
| other list                  | summary: `length N`, first five, last five |
| dict ≤ 50 entries           | key/value table                            |
| larger dict                 | summary                                    |
| obj                         | object card: class name and fields         |

A list is drawn as cards, not bars: bars are the usual sorting picture, but
every problem needs the numbers themselves (`9 > 7`, evenness, `dp`
values), and no list of the curriculum is longer than the card limit.

When any variable of the shown frame references an object, the tab also
shows one graph of all objects reachable from the frame: one card per
object (class name, scalar fields), one edge per reference-valued field or
list element, laid out top-down by longest path from the roots. Above 200
objects, the graph shows objects touched by the last 20 events and
`N objects`.

Refs of `lastEvent` are highlighted for 300 ms: `read` blue, `write` orange.
A `swap` slides the two cards past each other in 200 ms; a `write` changes a
card without a transition; the slide alone tells an exchange from two
writes.

Views are drawn with CSS transforms keyed by index and re-render only the
variables changed by the last event. The aim of 32 ms per drawn step is not
a requirement and owes no test: a frame-time assertion on CI hardware is
either too loose to mean anything or unreliable.

The learner may switch a list variable's view among `cards`, `grid` (lists
of lists only), and `tree`; the choice persists under `localStorage`
`algoflow:views` keyed by the program's storage key (`language.md`,
Storage) and the variable name. `tree` draws item `i` as a node whose
children are items `2i + 1` and `2i + 2`, laid out top-down by level, each
node showing its index and the item as inline text. The choice is kept
outside `Program`, which would export and diff it with the code. A challenge
never names a view: views are chosen by value type, with the learner's
switch as the one override.
