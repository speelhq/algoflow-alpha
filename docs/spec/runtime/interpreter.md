# Interpreter

Code: the runner `src/runtime/`; the driver `src/store/run.ts` with
`src/store/batches.ts`; the CPython check `scripts/check.ts` with
`scripts/lib/cpython.ts` and `scripts/lib/agreement.ts`. Tests: beside each
file; the rules of `language.md`'s Semantics as that section states.

## Runner

`run(program, inputs: Record<Id, Data>, seed: number, modules: Module[]): Runner`
executes a program with no diagnostics; `modules` are the modules the
program uses (`modules.md`, Resolution), empty when it uses none.

```ts
export type Runner = {
  next(): Event | Done;
  state(): State; // call only when paused
  stdout(): string[];
  draws(): number[]; // every random result in order
};
export type Done =
  | { type: "done"; steps: number; loops: number }
  | { type: "error"; error: RuntimeError; steps: number };
export type State = { frames: Frame[]; heap: Heap };
export type Frame = { fn: Id | "main"; module?: Id; callNodeId?: NodeId; vars: Map<Id, Value> }; // Modules
export type RuntimeError = {
  nodeId: NodeId;
  code: RuntimeCode;
  params: Record<string, string | number>;
};
```

`Runner.next()` resumes the program generator once; every yielded value is
one event. Frames form a stack owned by the runner; `call` pushes a frame,
emits `call`, executes the body, emits `return`, and pops. `E_STEP_LIMIT` is
returned by the `next()` after the 1,000,000th event; `E_RECURSION` when a
call would make the stack deeper than 200 frames.

Once `next()` has returned a `Done`, every later call returns that same
`Done` and emits no event, after `done` and after an error alike, so no
caller guards the end of a run; forbidding the call would put that guard in
every caller with nothing to catch one that forgot it.

The same program, inputs, seed, and modules produce the same event
sequence.

## Events

```ts
export type Event =
  | { type: "enter"; nodeId: NodeId }
  | { type: "read"; nodeId: NodeId; refs: Ref[] }
  | { type: "write"; nodeId: NodeId; ref: Ref; value: Value }
  | { type: "swap"; nodeId: NodeId; a: Ref; b: Ref }
  | { type: "compare"; nodeId: NodeId; result: boolean }
  | { type: "loop"; nodeId: NodeId; var?: Id; value?: Value }
  | { type: "call"; nodeId: NodeId; fn: Id; args: Value[] }
  | { type: "return"; nodeId: NodeId; fn: Id; value: Value }
  | { type: "print"; nodeId: NodeId; text: string };
export type Ref =
  | { var: Id }
  | { heap: HeapId; index: number }
  | { heap: HeapId; key: string }
  | { heap: HeapId; field: Id };
```

Per statement: one `enter`, then the events of its expressions (`read`,
`compare`, `call`/`return`), then its effect (`write`, `swap`, `print`,
`loop`).

`read` is emitted for `index`, `key`, and `field` reads and for `in` on a
list (one ref per compared element); variable reads emit nothing.

`write` is emitted for `assign`, `append` (new index), `insert`, `pop`
(removed index and value), `delete`, and each field set by `new`.

`compare` is emitted for every comparison `binop` (`== != < <= > >=` and
`in`), with its result; the operator and the operands are the node's. The
operand values are not carried in the event: alone (`3` and `0` of
`i % 15 == 0`) they hide where the 3 came from, while the narration writes
the comparison as the chart does, each variable replaced by its value
(`run.md`, Narration).

After `if` and `while` evaluate their condition, a `compare` with the
condition's id and its truth value (`language.md`, Semantics, Values and
the run) is emitted, unless the last event of evaluating the condition is a
`compare` with that id: each check of a diamond ends in one `compare` of its
whole condition. The driver cannot infer that truth from the region entered
next, as an empty region is entered by no statement and a loop's exit
enters whatever follows it. Only the last event counts: a call inside the
condition can reach the same diamond in another frame, with a `compare` of
the same id, and every call ends in its `return`.

`loop` is emitted at the start of each iteration of `for`, `foreach`, and
`while` (after the `while` compare).

`Done.loops` counts `loop` events; `Done.steps` counts all events.

## Errors

Runtime error codes:

| Code           | Raised by              | params                    |
| -------------- | ---------------------- | ------------------------- |
| `E_UNDEFINED`  | reading a variable never assigned (a loop that ran no iteration, `language.md`, Scope) | `name` |
| `E_INDEX`      | a list index (`language.md`, Semantics, Values and the run) | `index`, `length` |
| `E_KEY`        | a missing dict key (same)                         | `key`                     |
| `E_FIELD`      | a missing field (`language.md`, Semantics, Objects) | `cls`, `field`          |
| `E_TYPE`       | `+` mixing `str` and a number, ordering a number with a `str`, a dict key, a `for` bound, a `random_int` bound (`language.md`, Semantics) | `left`, `right` |
| `E_VALUE`      | `abs`, `int`, `float`, or unary `-` of a value of a type it does not take | `op`, `type` |
| `E_NUMBER_TEXT`| `int` or `float` of a text that is no such number | `op`, `text`     |
| `E_EMPTY_RANGE`| `random_int(a, b)` with `a > b`                   | `a`, `b`                  |
| `E_DIV_ZERO`   | division or modulo by zero; zero to a negative power | |
| `E_POP_EMPTY`  | `pop` on an empty list |                           |
| `E_ARITY`      | `new` with more arguments than fields             | `name`, `expected`, `got` |
| `E_RECURSION`  | a call deeper than 200 frames (Runner)            |                           |
| `E_STEP_LIMIT` | the 1,000,000th event (Runner)                    |                           |

`E_TYPE` params `left` and `right` are the type names of the operands
(`int`, `float`, `str`, `bool`, `none`, `list`, `dict`, or the class name);
a `bool` is not a number for arithmetic and ordering, where Python reads
`True` as `1`, which block programs never need there.

`E_VALUE` and `E_NUMBER_TEXT` carry as `op` the registry key of the failing
expression (`keyOf`), and `E_VALUE` carries as `type` the type name of the
value. `E_TYPE` names two operand types, which fits an operator but would
name neither the operation nor the fault of `abs("x")` (`abs and str …`).
`op` is written as the block's label, so the message follows the locale and
no block spells a message key.

## Blocks

Blocks implement their behaviour as generators (`run`, `nodes.md`):

```ts
export type Signal =
  | undefined | { kind: "break" } | { kind: "continue" } | { kind: "return"; value: Value };
export type StmtRunner = (node: Stmt, ctx: RunContext) => Generator<Event, Signal, void>;
export type ExprRunner = (node: Expr, ctx: RunContext) => Generator<Event, Value, void>;
export type RunContext = {
  program: Program;
  heap: Heap;
  eval(expr: Expr): Generator<Event, Value, void>;   // dispatches through the registry
  exec(body: Stmt[]): Generator<Event, Signal, void>; // emits `enter` per statement (Events)
  get(name: Id, nodeId: NodeId): Value;               // current frame
  set(name: Id, value: Value): void;
  call(fn: Id, args: Value[], nodeId: NodeId): Generator<Event, Value, void>;
  fail(nodeId: NodeId, code: RuntimeCode, params?: Record<string, string | number>): never;
  valueError(node: Expr, value: Value): never; // E_VALUE (Errors)
  textError(node: Expr, text: string): never;  // E_NUMBER_TEXT (Errors)
  random: { int(a: number, b: number): number };
  print(line: string): void;
};
```

## Modules

A call resolved to a module function (`language.md`, Scope) runs as a call
of a program function does, its frame having `module` set to the module
name.

Inside a module frame, a `call` or `new` resolves within that module
(`modules.md`, Resolution).

`run` accepts an entry `{ fn: Id; args: Data[] }` in place of `main`: the
named function of the program or module is the first frame, and `done` then
carries `value: Data`, the function's return value, and `args: Data[]`, the
arguments as they are after the run (`modules.md`, Resolution; Cases).

## Driver

### Steps and batches

A visible step is an event emitted while no module frame is on the stack,
or the `return` event of a call into a module: a module call is one visible
step. In a program's run a module function is a block, such as taking the
minimum of a heap, narrated by its returned value, and `Open <name>` shows
its interior (`modules.md`, Operations); a function the learner is still
building belongs to the program and is stepped into until `Move to module`.

The driver works through runners in batches of 20,000 calls of `next()`
with `setTimeout(0)` between them; at the heaviest work measured, about
0.65 µs a call, a batch takes about 13 ms, under one frame. A batch bounded
by time would never yield under the tests' fake timers, which stop
`performance.now`; it becomes the better choice once a block makes one call
far costlier.

Run first advances a separate runner, discarded afterwards, to its end in
batches and records `total`, the number of visible steps it produced
however it ended (after an error the failing step is step `total`),
`outcome`, how it ended, and `prints`, the visible step of each `print`;
then it creates the shown runner at step 0. Knowing the end before playing
tells the learner at once that a loop never ends, which playback at the
fastest speed would show after eighteen hours, gives the position bar its
length, and lets a wrong answer open at the step that printed the first
wrong line.

A run of a case takes the test's seed (`challenges.md`, Schema); a run with
no test, a Playground program's, takes seed 1, as a test without one does.

A run of no step is `done` at once. A finished run is `done` on reaching
step `total`, where the driver makes one further call of `next()` so that
its frames have unwound; a failed run is in `error` there. The call that
fails is a step of its own, so a failed run has `total = events + 1` and the
last position of the position bar is where its error is shown.

### Controls

Step: `next()` until the next visible step.

Play: one Step every `1000 / speed` ms, speed one of 1, 4, and 15 (`Slow`,
`Normal`, `Fast`, `run.md`, Run bar). A slider of 1 to 50 steps a second
was rejected as a number a beginner has no use for: `Slow` follows each
step, `Normal` watches a loop go round, `Fast` reaches a later point while
the chart still moves, and `Skip` and the position bar jump further.

Seek(k): a new runner advanced to visible step `k` in batches, rebuilding
`state`, `stdout`, and `verdicts` from every event it passes; when `k` is
at or after the current step, the driver continues the current runner in
place of a new one, and the two reach the same position (Runner).

Back: Seek(`step - 1`), and Seek(`k - 1`) while a Seek to `k` is in
progress.

Stop: discard the runner.

While the pre-run, a Seek, or a Skip works through its batches, `busy` is
true and the play button, Step, and Play do nothing, except that during a
Skip the play button reads `Pause` and cancels the Skip. `busy` stands
beside the five statuses because a sixth would make every test of `status`
in the screens three-way; a control taking over the runner would restart
the pre-run or leave a Seek at a step the position bar does not show.

Step over: `next()` repeatedly, in batches, until the frame count is at
most its value before the first `next()` and the run is at a visible step,
or the run ends. Expanding a call inline in the caller's chart was
rejected: the flowchart loses legibility one level down, and a function
would have two places to be edited.

The driver holds at most one breakpoint, a statement's `NodeId`, from its
setting until Stop. Play, Step over, and Skip pause at a visible `enter` of
that node and, when it is a loop, at each of its `loop` events (the run is
then at the loop's check); Step and Seek ignore it. Skip: `next()`
repeatedly, in batches and without publishing the intervening steps, until
such a pause or the end of the run. `Next pass`, a run to the next `loop`
event, was rejected: in bubble sort it stops at every inner pass, while the
instructive unit is one outer pass, and it cannot say which loop is meant.
A breakpoint says it by location: an outer pass on the outer loop, the next
output on a `print`.

### Published state

Driver state: `status` (`idle | paused | playing | done | error`), `step`,
`total`, `outcome`, `prints`, `lastEvent`, `state` (refreshed after each
step in step and play mode, at the end of each batch, and on pause, done,
error), `frame` (the index of the frame shown, `run.md`, Call stack),
`stdout`, `verdicts` (the last check result per diamond of the shown
frame's current pass, `run.md`, Path and marks), `taken` (the statements
entered in the shown frame's current pass, same), `pass` (for a `loop`
`lastEvent`, the number of that loop's passes since it was entered,
`run.md`, Narration), `activeId` (the statement that contains
`lastEvent`'s node, or after an error the failing node, `chart.md`, Zoom and
highlight), `breakpoint` (a `NodeId` or none, Controls), `busy` (Controls),
`caseIndex` (the chosen case, `chart.md`, Input nodes), `verdict` (the
chosen case's result, `challenges.md`, Judging, only while the run is at
step `total`), and `difference` (`{ step, line? }`, the step at which a run
started by `Watch this case` opened, `run.md`, Submission, until Stop).
After an error `lastEvent` is none at step `total`. The driver keeps `taken`
and `verdicts` per frame: a `call` starts the called frame's empty, and a
`return` gives back the caller's as they were. A published `state` is a copy of the frames'
variables and of the heap: a later step does not change it. `Done.steps`
counts every event, visible or not.

`state` is refreshed while playing because the `Result` tab follows every
step, the fastest speed included. `taken` and `pass` are kept by the
replaying projection because neither can be rebuilt from `lastEvent` after
a Seek. `Watch this case` is a run option, not a step passed in, as only the
driver's own pre-run knows where the differing line was printed. A shallow
copy of `state` would share the runner's maps and change at the next step,
so a screen could neither compare two states nor memoize on one; values are
immutable records, so one level of copy is enough.

## CPython check

For each challenge and test: run the interpreter on `solution`; emit
Python; write a script of (1) a shim replacing `random.randint` with a
function returning `draws()` in order and raising when exhausted, (2) the
emitted code with the test's inputs, (3) an epilogue printing one JSON line
`{"stdout": [...], "vars": {...}}` using the `toData` rules; write each
module the solution uses (`emitter.md`) as `<name>.py` alongside the
script; run `python3`; compare with the interpreter by the judge's equality
(`challenges.md`, Judging). Every built-in module (`modules.md`, Built-in modules) is also
emitted alone and compiled by `python3 -m py_compile`. The epilogue writes
Python's values as `Data` itself, so both engines are compared by the one
equality rule used for expectations.

## Verification

The tests of `src/runtime` cover the Semantics rules under Values and the
run (`language.md`); each runtime error code is tested with the rule or the
block that raises it; the tests of `src/runtime` and `src/store/run.ts`
cover determinism and every statement of Driver.
