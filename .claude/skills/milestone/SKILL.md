---
name: milestone
description: Plan or close one release milestone (vX.Y.Z) - split its Scope into issues and check its artboards, or confirm its exit criterion on main, tag it, and publish the release. Use when asked to plan, start, or finish a release or milestone.
argument-hint: <vX.Y.Z> [close]
---

Plan the release $ARGUMENTS, or close it when the arguments end in `close`.
The work on each of its issues runs through `/issue <n>`, one pull request
per issue (`CLAUDE.md`, Issues and commits).

A milestone is a release named `vX.Y.Z`. Its description states the goal,
the exit criterion, and, until the plan below splits it into issues, the
scope (a paragraph starting `Scope:`), which the split replaces with a
pointer to the issues. A release closes when its exit criterion holds on
`main`, which is then tagged `vX.Y.Z` with a GitHub release. Issues
written months ahead would describe screens whose artboards are not
settled, and replacing the paragraph keeps the scope in one place and marks
the split.

Plan and judge from the files this session reads itself (`CLAUDE.md`,
Judgement).

Each GitHub write (an issue, a milestone change, a tag, a release) waits for
approval (`CLAUDE.md`, Working style). Read and write GitHub with whichever
tool the session has (`gh` or the GitHub tools); a milestone write that no
tool of the session can make is the developer's, in the GitHub UI, and the
session gives the text to write.

## Plan

1. Read the milestone: its description states the goal and the exit
   criterion, and a `Scope` paragraph while the scope is not yet split.
2. List the milestone's issues, open and closed, and read every open one.
   Read the descriptions of the later open milestones: their scope is not
   yet due.
3. Read `docs/spec/README.md`, the whole spec file of every statement the
   scope and the open issues quote, and, for a screen,
   `docs/design/README.md` and its artboard.
4. Every screen, and every state of one (an open menu, a card, a dialog),
   that the release builds has its artboard in `docs/design/`; each missing
   one is filed as a `decision` issue of this release, as
   `docs/design/README.md` states. A better option than the spec or an
   artboard is proposed (`CLAUDE.md`, Judgement) before any issue that
   depends on it is worked.
5. While the description has a paragraph starting `Scope:`, split it: one
   issue per part a person can see working, each sized for one pull request
   (`CLAUDE.md`, Issues and commits), with the sections of
   `.github/ISSUE_TEMPLATE/task.md` (or `challenge.md` for problems), the
   part's statements quoted under Spec, and its share of the exit criterion
   under Done when; a choice the scope needs first is a `decision` issue.
   Check that every item of `Scope` is in exactly one issue, then replace the
   paragraph with `Split into the issues of this milestone.`
6. Recap: the issues in the order to work them, the decisions they wait on,
   and the open proposals.

## Close

1. Every issue of the milestone is closed; an open one stops the close until
   the user moves it to a later release or it is closed. With a clean
   working tree, `git fetch origin main` and
   `git switch --detach origin/main`; note the commit
   (`git rev-parse HEAD`). Run `pnpm install --frozen-lockfile`,
   `pnpm lint`, `pnpm test`, `pnpm check`, `pnpm build`, and
   `pnpm test:e2e` there, and walk the exit criterion in the running
   application; keep the output.
2. After approval, tag that same commit
   (`git tag -a <vX.Y.Z> <commit> -m "<vX.Y.Z>"`, then
   `git push origin <vX.Y.Z>`); publish a GitHub release of the tag, titled
   `<vX.Y.Z>`, listing the closed issues; close the milestone.
3. Recap: the tag, the release, the exit criterion with its evidence, and
   the issues left for later releases.
