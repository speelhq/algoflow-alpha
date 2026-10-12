# Design artboards

One PNG for each current artboard, exported at the size of the artboard.
An artboard shows the appearance of a screen and the spec (`docs/spec/ui/`)
states its behaviour; where they differ the spec is the decision, and a
better option than either is proposed
(`CLAUDE.md`, Judgement). A screen or a state of one that the spec
describes and no artboard draws, or a difference from its artboard the code
cannot follow, is an issue labelled `decision`, with a proposal, of the
release that builds the screen: filed when that release is planned
(`/milestone`) or when its work finds it, never earlier: planning a release
finds every screen it builds without an artboard, so an issue filed before
then would only repeat the spec and go stale. A session never draws or changes an artboard.

## Claude Design file "AlgoFlow Screens"

Twenty-three artboards of 1280 × 800. Each PNG has the name of its artboard
in the file.

| File | Artboard title | Spec (`docs/spec/`) |
| --- | --- | --- |
| `Main.png` | 1 Problems: one section per plan | `pages.md`, Pages and routes, Problems page |
| `BuildEmpty.png` | 2 Build: first launch, an empty chart | `pages.md`, Page layout, Problem tab, First launch; `chart.md`, Editing on the chart |
| `BuildMenu.png` | 3 Build: the + menu lists statements only | `editor.md`, Block menu; `chart.md`, Shapes |
| `BuildEdit.png` | 4 Build: editing a block, choosing a variable | `editor.md`, Node editor, Name fields, Node names |
| `EditValue.png` | 4B Build: where a value is expected | `editor.md`, Value line, Value list |
| `EditTyping.png` | 4C Build: typing, and the text becomes blocks | `editor.md`, Value line, Backspace and keys |
| `EditNumber.png` | 4D Build: after a number, and a named check | `editor.md`, Value list, Node names, Explanation line |
| `EditList.png` | 4E Build: after a list, what can be done with it | `editor.md`, Value list; `nodes.md`, Menu entries |
| `EditCheck.png` | 4F Build: an unnamed check, then And or Or | `chart.md`, Shapes; `editor.md`, Value list; `nodes.md`, Node text |
| `EditItem.png` | 4G Build: set one item of a list | `editor.md`, Value list, Name fields, Explanation line |
| `Run.png` | 5 Run: the moment on the chart, the state in Result | `run.md`, Run bar, Path and marks, Narration; `pages.md`, Result tab |
| `Wrong.png` | 6 Submit: Wrong Answer, and a way to the cause | `run.md`, Submission |
| `Accepted.png` | 7 Submit: Accepted, with what comes next | `run.md`, Submission |
| `Solution.png` | 8 Solution: read-only in the canvas | `pages.md`, Problem tab |
| `FunctionRun.png` | 9 Run inside functions: the path bar is the call stack | `run.md`, Call stack |
| `Module.png` | 10 Module page: run one function, keep cases, Test | `modules.md`, Resolution, Pages, Cases |
| `PythonChart.png` | 11 Python tab: a line and its block | `pages.md`, Python tab |
| `PythonFiles.png` | 12 Python tab: a program that uses a module | `pages.md`, Python tab; `emitter.md` |
| `Playground.png` | 13 Playground: many programs, the last edited first | `pages.md`, Playground page |
| `InputMenu.png` | 14 Build: the Input node lists the problem's cases | `chart.md`, Input nodes |
| `Diagnostics.png` | 15 Build: a red dot, its message, and its fix | `chart.md`, Editing on the chart |
| `PlaygroundProgram.png` | 17 Playground program: a title, Run, and Export | `pages.md`, Pages and routes |
| `MenuProgram.png` | 18 Build: the + menu lists the program's own functions | `editor.md`, Block menu |

## Where the spec deviates from the artboards

- `Accepted.png` shows placeholders for the counts of steps and loops, because
  `heap-pop` has no challenge file; the same holds for any artboard of a problem
  that does not exist yet.
- `heap.py` on `PythonFiles.png` and the `heap_pop` chart on `Module.png` are
  drafts derived from the `heap` module (`modules.md`, Built-in modules),
  not emitted code.
- `Main.png` names the first problem `Hello`; its challenge file is
  `tutorial`, and the title is the one in that file.
- `Main.png` notes that the page scrolls on to `Build a Tiny Neural
  Network` and `More problems`; the spec has three plans, and every problem
  is in one (`scope.md`, Curriculum).
- `Main.png` sets the row that `Continue` leads to on a coloured ground,
  which `pages.md`, Problems page does not state; every row is drawn alike.
- `Run.png` and `Wrong.png` fold the `Output` and `Expected` columns to
  `… n more`; the `Result` tab shows every line (`pages.md`, Result tab),
  and only the `Example` of the `Problem` tab folds (`pages.md`, Problem
  tab).
- The grey sentences under the rows of `Run.png` and `Wrong.png` annotate
  the artboards and are not part of the screen.
- The artboards use a hand-drawn typeface to mark them as drafts; the
  application uses the typeface of `src/ui/theme.css`.

## Exporting

An artboard is one file of its Claude Design file. It is rendered alone in a
browser at the size the file declares for it and captured as a PNG under the
name of the artboard. The Claude Design files remain the working copies, and
a changed artboard is exported again in the pull request that changes the
spec it affects. An artboard that a later artboard or the spec has replaced
has no PNG, because a PNG in the repository is read as the source of a
screen. The words are Claude Design's own, artboard and its file, so
`canvas` names the page's region that holds the chart.

| Claude Design file | Holds                                         |
| ------------------ | --------------------------------------------- |
| [AlgoFlow Screens](https://claude.ai/artifact/SD2jKu4HfkPTh4CoeS7Tpe) | the twenty-three artboards above |
| [AlgoFlow Redesign](https://claude.ai/artifact/D91141RiyMCW4XLsyJk8E5) | the flowchart and loop-notation studies; no exported artboard |

The files open only for their owner and the people they are shared with.
The links sit here, beside the export procedure, because whoever exports
again needs them, and a link reveals nothing to anyone without access.
