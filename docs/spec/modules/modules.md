# Modules

Code: types `src/modules/types.ts`, resolution `src/modules/resolve.ts`,
the store `src/store/modules.ts`, built-in modules `modules/<name>.json`.
Tests: beside each file.

## Schema

A module is one JSON value:

```ts
export type Module = {
  version: 1;
  name: Id; // a name as `language.md`, Identifiers allows; its Python file is <name>.py (`emitter.md`)
  title?: Localized; // built-in modules only; a learner module shows `name`
  classes: ClassDef[];
  functions: FunctionDef[];
  cases: Case[]; // Cases
};
export type Case = {
  fn: Id; // a function of this module
  args: Data[]; // one per parameter
  expect: { returns: Data; args: Data[] }; // the value returned, and the arguments after the run
};
```

`validate()` (`language.md`) applies to a module as to a program with no
`main`; node ids and names are unique within the module as within a program.
A module sits outside `Program` because it belongs to the learner, not to
one program: defined once, edited in one place, and used by many programs.
`Module` was chosen over `Functions`, which collides with the block menu's
`Function` category, excludes classes, and cannot group a `heap`, and over
`Library`, a single flat collection; it is the Python word the learner
meets again as `import`.

Module names are unique among learner modules and unique among built-in
modules; a learner module with a built-in module's name shadows it
(`language.md`, Scope), so that a block the learner rebuilt is used under
its name with no problem having to say which one. Built-in modules are
read-only.

## Resolution

Every module is visible to every program; a program uses a module by
calling one of its functions or constructing one of its classes
(`language.md`, Scope). Nothing in `Program` names a module.

`usedModules(program, modules): Module[]` is the set of modules whose
functions or classes the program's calls and `new` expressions resolve to,
in name order; `run` (`interpreter.md`, Runner), `emit` (`emitter.md`), and
`judge` (`challenges.md`, Judging) receive it.

A module function sees its parameters and the functions and classes of its
own module (`language.md`, Scope); a module uses no other module, and a name
of a program or of another module is `E_UNKNOWN_CALL` inside a module.
Imports between modules would need dependency order, cycle detection, and a
second `from … import` layer in the emitted files, which no problem of the
curriculum needs; the rule is lifted when a challenge's `module` has to call
another learner module.

A module has no `main`. Its page runs one function at a time
(`interpreter.md`, Modules): the shown function's parameters are Input nodes
in the form of `chart.md`, Input nodes, their menu listing that function's
cases (Cases), and holding the arguments `Open <name>` brought (Operations)
when the page was opened with them; after a run `End` shows the returned
value.

## Pages

Modules page (`#/modules`): one row per module (name or title, the number
of functions and classes, `Built-in` on built-in modules), learner modules
first in name order; `New module…` (prompts for the name), `Import…`
(Operations), and per learner row `Export` and `Delete` (Operations). The
rows have the form of `pages.md`, Playground page.

Module page (`#/m/<name>`, and `#/m/<name>/<fn>` showing that function):
the top bar with `← Modules`, the name, undo, redo, and `⋯` with Help; the
panel with the tabs `Result`, which holds `Test` (Cases) beside its case
selector, and `Python` (`pages.md`, Tabs); the canvas with the path bar
(`chart.md`, Charts and the path bar), whose `▾` lists the module's functions and classes, `Add
function`, and `Add class`, and the run bar with `▶ Run` (`run.md`, Run
bar). A learner module's canvas carries the band
`Your module. Changes reach every program that uses it.` A built-in
module's charts are read-only, its editors offer neither editing nor
`Duplicate` and `Delete`, `▾` offers no `Add`, and the top bar has `Clone`
(Operations). Edits persist under Storage with the timing of `language.md`,
Storage.

## Operations

`Move to module…` (`chart.md`, Charts and the path bar; `run.md`,
Submission) moves a function or
class, with every program function and class it references, into an
existing or new learner module; the program's calls then resolve to the
module. It is one undoable edit of the program; the module change is not
undone.

`Clone`, on a built-in module's page, creates a learner module with the
same name, content, and cases, which shadows the built-in one (Schema) and
opens for editing. The word was chosen over `Copy to my modules` as one the
learner meets again in programming. `Copy into this program`, copying one
module function into a program where it shadows the module, was rejected:
it would be a second way to own module code, and it would leave a call that
looks the same while it resolves to something else.

`Delete` lists the programs whose calls resolve to the module and requests
confirmation; afterwards those calls are `E_UNKNOWN_CALL` (`chart.md`,
Editing on the chart).

A module exports as `<name>.algoflow-module.json` (the Schema value); a
program export (`language.md`, Storage) embeds the modules it uses under
`modules`; import validates each by `version`, adds modules whose names are
new, keeps existing ones unchanged, and reports `Kept existing module
<name>`.

`Open <name>` on a module function or class (`editor.md`, Node editor;
`run.md`, Errors) opens its Module page in the browser window named
`algoflow-module`, so a second open reuses that tab: the Module page, on
finding `algoflow:handoff`, saves its pending edits, discards any run
(`interpreter.md`, Controls), and shows the named function. The
function's arguments accompany it: from a run, the arguments of that call as
they stood at its `call` event (`interpreter.md`, Controls); in build
mode, the arguments that are literals; otherwise none. They are transferred
with the module and function names under `localStorage` key
`algoflow:handoff`, which the Module page reads once and removes, and they
become the Input nodes' values (Resolution). A second tab keeps the
program, a paused run included, as it was, and runs the one function with
that call's arguments, which finds a bug in `heap_pop` sooner than hundreds
of steps of `dijkstra`. Showing the module's chart within the program page
was rejected, as it needs a second, shared-edit mode of the page. The second
window is a tab, as two tiled windows would fall below the 1280 px width
(`scope.md`, Product).

## Cases

`Save as case`, in the `Result` tab after a run of a function, adds a case
holding that run's arguments, returned value, and arguments after the run; a
case can be deleted. A module change reaches every program, so a module
needs tests of its own, and a case is a saved run so that none is written
from an empty start. Cases recorded from an accepted submission were
rejected: no rule selects suitable calls (the first `heap_push` of a test
pushes onto an empty heap, and a recursion makes thousands of calls), they
would fix the learner's own behaviour as correct, and they leave out the
act of judging a result.

`Test` runs every case of the module, each on its own runner
(`interpreter.md`, Modules), and the `Result` tab shows `k of n passed`, one
chip per case grouped by function (the first failing one selected), and for
the selected case its arguments and `Yours` beside `Expected` for the
returned value and for the arguments after the run, compared by the judge's
equality (`challenges.md`, Judging), with `▶ Watch this case`.

When `Move to module…` places a function into a learner module whose name
is a built-in module's, and the built-in module holds cases for a function
of that name while the learner module holds none, those cases are copied
into the learner module (`Clone` copies all of them), as the author's
cases, checked in both engines, find what the problem's tests do not.

## Storage

`src/store/modules.ts` is the only reader and writer of learner modules; it
persists them under `localStorage` key `algoflow:modules` as
`Record<Id, Module>` 500 ms after the last edit and exposes `list()`,
`get(name)`, `put(module)`, and `remove(name)`; nothing else accesses the
key. `localStorage` and export files suffice for a course on one machine; a
server would earn its accounts only with sharing between learners or
synchronisation across devices, and one store keeps that open without
changing its callers.

The store re-reads `algoflow:modules` on the window's `storage` event, so
an edit in one browser tab propagates to the others: open programs are
validated again. A run in progress retains the modules it began with
(`interpreter.md`, Runner), so its replays stay deterministic; the next Run
uses the modified ones, with no stop and no message.

## Built-in modules

`modules/<name>.json` files are bundled like challenges (`challenges.md`,
Opening and bundling) and checked by `scripts/check.ts`: the Schema, then
name resolution within the module, then emitted and compiled as the CPython
check states (`interpreter.md`, CPython check), then every case run in the interpreter and
in CPython and compared by the judge's equality. A challenge `solution` may
use built-in modules (`scope.md`, Curriculum) and no learner module.

The built-in module `heap` (title `Heap`) defines `heap_push(heap, x)`, which
appends `x` and sifts it up with `swap`, and `heap_pop(heap)`, which removes
the root, moves the last item to the root, sifts it down, and returns the
root; items are compared with `<`, and a list item by its item 0;
`heap_pop` on an empty list raises `E_POP_EMPTY` from the list method it
calls. The names carry the prefix, as `heapq.heappush` does, because `pop`
alone would sit beside the list method `pop` in the block menu (`pop(h)`
against `h.pop()`).

## Verification

Tests cover the resolution and shadowing of names (`language.md`, Scope),
the emitted files of a program using `heap` (`emitter.md`), the frames and
visible steps of a module call and Step over (`interpreter.md`, Modules;
Controls), entry runs,
the export and import round trip, `Test` verdicts, and the copying of a
built-in module's cases.
