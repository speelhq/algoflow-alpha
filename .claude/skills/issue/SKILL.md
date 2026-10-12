---
name: issue
description: Work one GitHub issue into one pull request against main - read its spec, propose where a better option exists, spec-first commits, the author's review, a spec review and /code-review as candidates, every finding settled. Use when asked to work on, fix, implement, or continue an issue.
argument-hint: <issue number>
---

Work issue #$ARGUMENTS into one pull request from `main` (`CLAUDE.md`,
Issues and commits). Each GitHub write (a push, the pull request, an issue) waits for
approval (`CLAUDE.md`, Working style). Read and write GitHub with whichever
tool the session has (`gh` or the GitHub tools). When a session ends before
the pull request, push the branch after making its commits final
(`CLAUDE.md`, Issues and commits); the next `/issue $ARGUMENTS` continues it.

Plan and judge from the files this session reads itself (`CLAUDE.md`,
Judgement).

## 1. Read

1. The issue; an issue no release takes waits until one does. The
   description of its milestone for the release's exit criterion, and the
   descriptions of the later open milestones: their scope is not yet due
   and is left alone.
2. `docs/spec/README.md`, and the whole spec file of every statement the
   issue quotes.
3. For a screen, `docs/design/README.md` and the screen's artboard.
4. Every source file and test the change touches, whole.

## 2. Decide

1. When the issue is too large for one pull request (`CLAUDE.md`, Issues and
   commits), propose a split and wait: a pull request that stands alone is
   never stacked or retargeted, is reviewed while it is small, and lets any
   merge be released.
2. Where the spec or an artboard has a better option, and on a conflict with
   the spec, propose and wait (`CLAUDE.md`, Judgement). A screen state no
   artboard draws, or a difference from its artboard the code cannot follow,
   is handled as `docs/design/README.md` states and is not built before it
   is settled.
3. An issue whose Spec waits on an open `decision` issue waits for it.
4. A choice the spec does not cover is proposed as a statement, with its
   reason where `docs/spec/README.md`, Reasons asks for one.

## 3. Build

1. Continue the issue's branch when one exists
   (`git branch -a --list "*/$ARGUMENTS-*" "$ARGUMENTS-*"` after `git fetch`);
   otherwise `git switch -c $ARGUMENTS-<slug> origin/main`.
2. The spec statements in one commit, before any code.
3. One vertical slice per commit, each when `pnpm lint && pnpm test` passes;
   `pnpm check <challenge.json>` before a commit that changes that
   challenge.
4. A screen's states are drawn by `e2e/screenshots.spec.ts` and written to
   `e2e/screenshots/` by `pnpm screenshots`; look at each image beside its
   artboard.

## 4. Review

Before its pull request a change is reviewed three times: first by its
author, then by two reviews side by side that report candidates. The author
reads first so that no candidate steers the reading; the narrow spec brief
keeps preferences out; and each review finds what the others do not.

1. Read `git diff origin/main...HEAD` whole, against the issue's Done when,
   every statement it touches, and the shapes `CLAUDE.md`, Judgement
   forbids, before any candidate arrives.
2. Then, in one message, start both candidate reviews:
   - a subagent given the diff range, the statements the issue quotes, and
     the later milestones' scope, which reports only a statement the diff
     violates or behaviour no statement requires, each with the statement
     quoted with its file and heading, `file:line`, and a concrete scenario;
   - `/code-review` on the branch, which reports defects.
3. Check every candidate against the files.
4. Settle every finding (`CLAUDE.md`, Judgement); a filed one takes its
   template's sections and label (`CLAUDE.md`, Issues and commits).

## 5. Finish

1. Make the unpushed commits final (`CLAUDE.md`, Issues and commits).
2. Run and keep the output: `pnpm lint`, `pnpm test`, `pnpm check`,
   `pnpm build`, `pnpm test:e2e`, and `pnpm commits origin/main..HEAD`.
3. After approval, push and open one pull request against `main` whose body
   follows `.github/pull_request_template.md`: What, Why (the statements,
   the issue, and the milestone), Closes (`Closes #$ARGUMENTS`), Verification
   (the command output, pasted), Screenshots (when a screen changes), and
   Notes (deviations, open proposals, and the issue of each finding left for
   later). GitHub closes an issue on merge only when the body names it, and
   pasted output is evidence where a ticked checklist is an assertion.
4. Recap: the pull request, the Done when with its evidence, every finding
   with its outcome, and the open proposals.
