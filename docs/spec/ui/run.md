# Run

Code: `src/ui/problem` (`RunBar.tsx`, `actions.ts`, `keys.ts`,
`ResultTab.tsx`, `SubmissionView.tsx`), `src/ui/run/narrate.ts`,
`src/ui/chart/paint.ts`, the driver `src/store/run.ts`, and the submission
`src/store/tests.ts`. Tests: beside each file, and `e2e/`.

## Run bar

The run bar at the foot of the canvas holds `▶ Run` in build mode. `Run`
with diagnostics present does not start: it shows the chart of the first
node with a diagnostic, selects that node, and shows its message (`chart.md`,
Editing on the chart); `Submit` does the same. Otherwise `Run` pre-runs the
program (`interpreter.md`, Steps and batches) with the Input nodes' values
and puts the page in run mode: editing is disabled. `Run` is never disabled
for a diagnostic, as a disabled button gives no reason; an empty slot is
reported only this way, since a block marked red when inserted would report
an error before the learner had finished its value. Editing stays disabled
while paused: an edited program replayed to the same step arrives somewhere
else, and resynchronising by node breaks on the edited node.

In run mode the run bar holds, from its left, one play button in place of
`▶ Run` (`❚❚ Pause` while playing, `▶ Play` while paused, and `↺ Replay` at
the run's last step, which seeks to step 0 and plays), `|◀ Back`,
`Step ▶|`, `Step over`, `Skip ▶▶` (`interpreter.md`, Controls), the position
bar `step k of N`, which can be dragged to any step (`interpreter.md`, Controls), the speed as
three choices `Slow`, `Normal`, and `Fast`, and `■ Stop`. Playback starts
playing at the remembered speed (`Normal` at first, persisted under
`algoflow:layout`); `▶ Watch this case` (Submission) starts paused. A run
whose pre-run ends in `E_STEP_LIMIT` reports it (`run.endless`) before
playback. `Stop` returns to build mode; once the run has ended, in `done` or
`error`, clicking a node also returns to build mode and opens that node's
editor. `Run` and `Play` are one button, serving one intention, so the
button pressed to start is the one that pauses; the controls are too long
to float over the chart's corner without covering a loop's back edge. A
click edits after the end because a finished run has no position to keep,
which puts the failing node of an error one click from its correction.

Before the run has ended, clicking a node sets the breakpoint on it
(`interpreter.md`, Controls), pausing first when the run is playing;
clicking the node that holds it, or Esc, clears it. The node shows a
breakpoint mark (`run.breakpoint`), and the run pauses each time it arrives
there; `Skip` continues to the next arrival without drawing the intervening
steps, or to the end of the run when no breakpoint is set. In build mode a
click edits and sets no breakpoint. A `Run to this node` action was
rejected: it would give nodes a context menu, which nothing else on the
chart has, and a modifier on the click has no touch equivalent.

## Path and marks

While running, the edges and nodes of the running frame's current pass are
drawn in the taken-path colour: a `Yes` edge when its diamond's mark is
`✓`, a `No` edge when it is `✗`, an unlabelled edge when both its ends are
on the path, and, once control has left a loop that has ended, its `No` edge
when what it leads to is on the path (a statement, the next loop's junction,
or a branch's merge). A `call` starts the called chart with no path and no
marks, as a loop's new pass does, and a `return` gives back the caller's as
they were; a frame shown by a click on its segment (Call stack) shows its
own. The marks decide the labelled edges because the path holds both ends
of a diamond's `Yes` and `No` edges whenever the diamond was entered.

While running, the current node has the accent outline and is scrolled into
view.

A diamond shows `✓` or `✗` after its check: the result of the `compare` of
its whole condition (`interpreter.md`, Events), or of the `loop` event of a
generated check, never that of a comparison inside the condition: the last
inner compare of `not (a < b)` or `a < b and c < d` is not the answer, and
`found` holds no comparison at all.

A diamond's mark is cleared when the diamond is entered again and when a
loop containing it starts a new pass (its `loop` event clears every diamond
in its body); a loop's own diamond is also cleared at the first `enter` of a
statement outside that loop, so a loop that has ended shows no mark once the
run has moved on; a loop that is the last statement of its frame is
followed by no `enter` and keeps its mark. Clearing a mark only on re-entry
would leave a diamond the current pass skipped showing the previous pass's
`✗`, which reads as false now for a condition never evaluated. An event for
a `for`'s failed check was rejected, as it would change the event count of
every finished loop.

No variable's value is drawn on the chart: the current values are in the
narration (Narration), every variable is in the `Result` tab (`pages.md`,
Result tab), and the call stack is the path bar (Call stack). Tabs of data,
trace, and output under the program were rejected, as they draw attention
away from it. So were a badge with the loop variable beside a loop's check,
which would be out of view while a long body runs and, for a `while`, would
need a guess of what to show; a card at the chart's top right, which covers `Yes` branches; an
output strip beside `End`, out of view in a long chart; and a trace table,
which serves instructors, not learners.

## Narration

While running, the narration line, one line between the chart and the run
bar, describes the last event in one sentence (`run.narrate.*`): `enter` →
`Checking (remainder of i divided by 3) = 0` for a condition and the
block's sentence otherwise; `read` → `Read item 2 of nums: 5`, or for
several items `Read 3 items of nums`; `compare` → the comparison as the
chart writes it (`nodes.md`, Node text), every variable that holds a
number, a text, a boolean, or none written as its value in the frame the
event ran in, and its value (`3 < 10 is true`), or for a diamond's whole
condition its question and answer (below); `write` → `i is now 3`; `swap` →
`Swapped items 1 and 2 of nums`; `loop` → `Pass 3: i is 3`, or without a
variable `Pass 3`; `print` → `Printed "Fizz"`; `call` → `Calling f(2)`;
`return` → `f returned 4`, which is the sole narration of a module call
(`interpreter.md`, Steps and batches); the end of the run →
`Finished in 124 steps`; an error → the message (`pages.md`, Messages).
Values are written as `pages.md`, Values on one line states. A tooltip
beside the current node was rejected: it would move with every step, cover
the node it describes, and leave the view near an edge.

The `compare` of a diamond's whole condition is narrated as the diamond's
question and the label of the edge taken, the condition written as a
comparison is written above (`(remainder of 3 divided by 15) = 0? No`,
`3 < 15 + 1? Yes`), except that a condition that is one variable keeps its
name (`found? Yes`). `is false, so No` would say a third time what the mark
and the edge show, with a word found nowhere on the chart; a lone variable
keeps its name, as its value in its place would drop the question
(`true? Yes`).

A named node is narrated by its statement, not its name.

The narration names a location by the variable of the frame the event ran
in that holds it: an item `item 2 of nums`, a field `next of node`, a
dict's key `counts at "a"`; a list that no variable of that frame references
is `a list` (`run.narrate.ref.*`).

## Errors

A runtime error outlines the failing node in the error colour, shows the
message (`pages.md`, Messages) in the narration line in the error colour,
stops playback, and leaves the path bar on the failing frame's stack; an
error inside a module function is shown on the node that called it, whose
`Open <name>` carries that call's arguments (`modules.md`, Operations).

## Call stack

While running, the path bar is the call stack: `main` first, one segment
per frame, the last one running; the chart shows the running frame and
follows it on every `call` and `return`, and Back and Seek show the frame of
the step they reach. A module function's frame is never a segment: its call
is one step (`interpreter.md`, Steps and batches). A segment reads
`name(args)` with numbers, texts, and booleans shown and any other argument
as `…`, adjacent ones merged; beyond `main` and the last three segments the
middle collapses to `… n`, which lists them on click. While paused, clicking
a segment shows that frame's chart with the call it awaits marked and that
frame's variables in `Result` (`pages.md`, Result tab); the next step
returns to the running frame. While playing, the click pauses first.

## Submission

`Submit`, beside the case selector of the `Result` tab (`pages.md`, Result
tab), judges every test on its own runner (`challenges.md`, Judging),
records the attempt (`challenges.md`, Progress), and selects the `Result`
tab.

A failed submission shows `Wrong Answer`, `k of n cases passed`, one chip
per case (`✓`/`✗`, the first failing one selected), and for the selected
case the rows of the `Result` tab with the first differing one marked, and
`▶ Watch this case`, which sets the Input nodes to that case and starts a
run paused at the first difference (`interpreter.md`, Controls): the step of the `print` that
produced the first differing line, or the last step of the run when no
`print` produced it or a variable differs. The narration there identifies
which (`run.narrate.difference`: `This printed line 1`, shown at that step
in place of the event's sentence; `The run ended here`); the position bar
returns to step 0.

A wrong answer is shown as its rows and nothing else: no sentence is
generated about the difference, and no node is marked on the chart; only a
runtime error marks a node (Errors). `Hint` names the three authored hints
of a challenge (`challenges.md`, Hints) and nothing generated. The node
that printed a differing line is rarely the cause (a loop started at 0
prints `FizzBuzz` from a correct block), so marking it would assert what
the application does not know; `▶ Watch this case` and Back lead to the
cause. A sentence classing the difference as a missing line, an extra line,
or a different value has no rule behind it: `1, 2, 3` against `2, 4, 6`
reads as an extra `1`.

An accepted submission shows `Accepted`, one `✓` chip per case, the steps
and loops of the first case, every event counted (`Done`), a module's
included, `What you used` (the challenge's `takeaway`, `challenges.md`,
Schema), `Move to module <name>` when the challenge names a module
(`challenges.md`, Modules and definitions) and the program has a function or
class (`modules.md`, Operations), `See your program as Python`, which selects
the `Python` tab, `Compare with the solution` (`pages.md`, Problem tab),
`Open in Playground` (`pages.md`, Help and `⋯`), and `Next problem →` (the
first unsolved problem of the current plan after this one, wrapping to the
plan's start; once every problem of the plan is solved, the next row of its
section) or, after the last problem of a plan with every problem solved,
`Plan complete` with `Back to Problems`; the problem becomes solved
(`challenges.md`, Progress). The count is the work done, not the visible
steps of the position bar, so `dijkstra-heap` shows fewer steps than
`dijkstra-grid` though each heap call is one visible step. `Next problem`
counts round from the plan's start, as a skipped problem is one the plan
still asks for, and `Plan complete` returns the choice to the learner,
where the next row after the last `course` problem would put a trainee into
the first data-structure problem.

After `Submit` the `Result` tab shows the submission in place of the run's
rows until the next `Run`, the next `▶ Watch this case`, or a change of the
program: the verdict, the case chips, and, for a wrong answer, the rows of
the selected chip's test. The tab cannot show a run's rows and a
submission's in 320 px, and a changed program is no longer the one judged.
While running, `Submit` is disabled, as a verdict arriving during playback
would replace the rows being watched.

A change of the program while `Submit` is judging abandons the submission:
no verdict is shown and no attempt is recorded (`challenges.md`, Progress).

A chip of a wrong answer selects which test's rows are shown and changes
neither the Input nodes nor the run (`challenges.md`, Judging); the chips
of an accepted submission select nothing. Setting the Input nodes is left
to `Watch this case`, so a chip never changes the case under the chart.

A test that ends in a runtime error shows its message (`pages.md`,
Messages) in place of `Output`.

A submission in which a name listed in `defines` (`challenges.md`, Modules
and definitions) resolves to a built-in module shows, in place of a
verdict, `{name} comes from the built-in module {module}. Build it in this
program, or Clone the module and build it there.` (`result.builtin`), and
records nothing.
