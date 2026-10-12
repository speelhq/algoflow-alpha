# CLAUDE.md

@ARCHITECTURE.md

## Commands

```
pnpm dev · pnpm test [path] · pnpm lint · pnpm format · pnpm build
pnpm check [challenge.json]   # schema, interpreter, CPython 3.12+ (python3 or $PYTHON), i18n
pnpm commits <base>..<head>   # each commit's message, as CI checks a pull request
pnpm test:e2e · pnpm screenshots   # after build; screenshots rewrites e2e/screenshots/
```

Run `pnpm lint` and the relevant `pnpm test <path>` after each set of edits;
`pnpm check` passes on every pull request. Report output, not a summary.

## Sources of truth

`docs/spec/` states what must be (its `README.md` says how it is written);
the code states what is; the open milestone, its issues, and the open pull
requests say what is next. No handoff file: it would repeat them and drift.
Before changing an area, read the spec its file in `.claude/rules/` names.

## Judgement

A plan and every judgement are made from files the session reads itself.
An agent may locate code, run a reproduction, or report review candidates
(`/issue`, Review); nothing it returns is used before the session checks it
against the files. An agent reads excerpts, and its summary looks like
a reading of the whole code.

Where the spec or an artboard has a better option, propose it: the current
choice and its reason, the alternative, and why it is better; nothing is
built on a proposal before the developer decides. A task that conflicts
with the spec stops and reports the conflict with a proposal, which spares
the developer from finding the better option alone.

A finding, from a review or noticed in passing, is fixed in the change,
dropped with its reason, or filed as an issue; until then it is a task of
the session. A fault the change introduced is fixed in that change, or the
change waits for the decision its fix needs. A finding kept only in a
conversation is lost, and a change that defers its own fault ships it.

A change takes none of these shapes: an optional parameter or default that
silently changes a result; hidden state or a side map; a second copy of a
rule or a lookup; a helper kept on an old model to spare test changes; a
branch left for a removed case; positional coupling; a renamed concept left
under its old name; a fix at a symptom whose structural cause it leaves,
unless it records where and why that structure is changed. Each hides
a rule or a value where the next reader does not look.

## Working style

Targeted edits over rewrites. Stay within the task; settle each finding as
Judgement states. Batch independent reads. One line before starting; a
standalone recap at the end (changed files, evidence, remaining work). A
turn does not end on a plan, a question, or a status report while the next
step is an edit, a test run, or a commit; it ends on a proposal, a conflict
with the spec, or a step that needs the user's permission (`git push`,
`rm`, a GitHub write), and names what is ready and what waits. When
compacting keep: changed files, the current issue and its Done when, open
findings and proposals, test commands, decisions not yet in `docs/spec/`.

Skills: `/issue`, `/milestone`, `/add-node`, `/add-challenge`.

## Issues and commits

One issue is one pull request from `main`, of at most about 1,500 changed
lines, that leaves `main` releasable; a larger one is split first. An
issue is filed from its kind's template in `.github/ISSUE_TEMPLATE/`
(`.claude/rules/github.md`).

Commit one vertical slice at a time, when `pnpm lint && pnpm test` passes;
a cross-cutting type, event, or spec change goes first, alone. Conventional
Commits, an imperative subject under 50 characters, scope a folder of
`src/` or `scripts`, `docs`, `ci`; a body only when the reason is not
evident; no trailers; never mention Claude, the session, or the prompt (CI
runs `pnpm commits`). Before a push the unpushed commits are made final: a
fix of an earlier one is folded into it (`git commit --fixup <sha>`, then
`GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --keep-base origin/main`),
and a commit a later one withdraws is dropped with it. A pushed commit is
rewritten only to rebase onto `main`, with `git push --force-with-lease`.
`main` takes rebase merges only, after CI, so every commit lands on
`main`, where one that a later one undoes misleads `git blame` and
`git bisect`.

## Tooling notes

- `pnpm lint` fails on a warning: fix it, turn its rule off in
  `.oxlintrc.json` beside the reason, or exempt one line with
  `// oxlint-disable-next-line <rule> -- <reason>`. `no-base-to-string`
  rejects `String(unknown)`.
- Hooks: oxfmt runs on every file written inside the repository (it skips
  `docs/`; format a file written by a script with `pnpm format`), so re-read
  a file before a follow-up Edit; `pnpm lint` runs before `git commit`. In
  Markdown oxfmt unindents a list item's line that continues a code span:
  keep each code span on one line.
- Multi-line edit scripts: write them to the scratchpad and run the file;
  a heredoc passed to the Bash tool turns `\\` into `\`.
