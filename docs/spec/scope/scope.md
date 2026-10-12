# Scope

This file governs the whole product and has no code of its own.

## Product

AlgoFlow is a single-page web application running entirely in the
browser, with no server, no accounts, and no roles: an instructor's work
(challenge files, plans, built-in modules) is authored in the repository,
not in the application, so a trainee and a self-learner use the same
features.

The application targets desktop browsers at 1280 px width or more;
narrower viewports show `app.desktopOnly` and no editor.

The UI is available in English and Japanese. The initial language is the
browser language when a locale for it exists, otherwise English; the
header switches it and the choice is stored in `localStorage`.

The application is deployed as static files to GitHub Pages from `main` by
CI.

## The learner

The learner may have never programmed; every problem, hint, and solution
is written so that a learner without an instructor can complete it
(`challenges.md`, Hints).

In one problem the learner reads the statement, builds the chart, runs it
on one input and watches it, compares the result with the expected one,
fixes the chart, submits, and moves to the next problem. The UI is built
around this loop; cards that read as code lines, with a blocks palette, a
properties panel, and tabbed run panels, were rejected, as they keep control
flow invisible, place values in a table apart from the program, and put
instructor tools beside the loop.

Across problems the learner moves functions and classes into a module
(`modules.md`, Operations) and uses them from later problems and from
Playground programs (`modules.md`, Resolution). Plans chain through
modules, not through starters: a problem starting from the previous
solution would discard the learner's own version, while a module keeps it,
so a bug in the learner's `heap_pop` met again in `dijkstra-heap` makes the
learner inspect the block they rely on.

## Curriculum

The problem set is exactly the problems of these study plans
(`challenges.md`, Study plans), in this order:

| Plan                                   | Problems, in order                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `course` 3-Day Course                  | tutorial, sum-to-n, fizzbuzz, max-of-three, countdown, list-max, count-evens, linear-search, binary-search, bubble-sort, selection-sort, insertion-sort, reverse-list |
| `structures` Build the Data Structures | stack-balance, bfs-grid, heap-push, heap-pop, dijkstra-grid, dijkstra-heap, astar-grid                                             |
| `dp` Dynamic Programming               | coin-change, knapsack, lcs                                                                                                         |

A plan's problems build on the ones before (the `structures` problems
through the list as a stack, the list as a queue, and the `heap` module;
the `dp` problems from one dimension to two and to strings), so the order is
part of the plan. The `course` plan mirrors a fixed three-day course, and
adding a problem to it is the instructor's decision.

Every challenge is solvable with the blocks in `nodes.md` and the built-in
modules (`modules.md`, Built-in modules), and with no other means.

A Playground program has no `challengeId`, no inputs, no tests, and no
Submit; there may be any number of them, each stored under its own id
(`language.md`, Storage).

## Acceptance

Every built-in challenge's `solution` passes all of its tests in the
interpreter and, as emitted Python, in CPython 3.12 or later.
