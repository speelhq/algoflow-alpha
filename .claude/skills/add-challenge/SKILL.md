---
name: add-challenge
description: Create a challenge JSON with tests, hints, and solution per docs/spec/challenges/challenges.md and verify it with pnpm check. Use when asked to add a challenge, exercise, task, or problem for learners.
argument-hint: [challenge id]
allowed-tools: Bash(pnpm check *)
---

Create the challenge described in $ARGUMENTS.

1. Read `docs/spec/challenges/challenges.md` (schema and the challenge's row),
   the curriculum of `docs/spec/scope/scope.md`, and
   `challenges/fizzbuzz.json` as the reference file.
2. Write `challenges/<id>.json` with: English title and description (add
   Japanese texts only if `src/i18n/ja.json` exists), difficulty, topics,
   inputs, at least three tests of which one is a boundary case marked
   `"edge": true` (`challenges.md`, Checks; tests have no name and are shown
   by their inputs), three hints, a `takeaway`, and a complete `solution`.
   Add its id to its plan in `challenges/plans.json`, at its place in the
   curriculum: every problem is in exactly one plan.
3. Run `pnpm check challenges/<id>.json`.
4. Recap: id, plan, number of tests, and the solution's emitted Python.
