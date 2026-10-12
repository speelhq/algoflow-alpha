# Specification

## Files

One folder per area, holding its specification files.

| Folder        | File             | Defines                                                         |
| ------------- | ---------------- | --------------------------------------------------------------- |
| `scope/`      | `scope.md`       | product scope, the learner, curriculum, acceptance              |
| `language/`   | `language.md`    | AST types, data model, semantics, validation, edits, kinds      |
| `nodes/`      | `nodes.md`       | every block: slots, Python output, sentence, chart, menu entries |
| `runtime/`    | `interpreter.md` | runner, events, runtime errors, driver, CPython check           |
|               | `emitter.md`     | the Python emitter                                              |
|               | `parser.md`      | the expression parser                                           |
| `ui/`         | `pages.md`       | pages, panel, first launch, keyboard, messages and i18n         |
|               | `chart.md`       | the chart                                                       |
|               | `editor.md`      | the block menu, the node editor, value lines                    |
|               | `run.md`         | running and submission                                          |
|               | `views.md`       | the views of the `Result` tab                                   |
| `challenges/` | `challenges.md`  | challenge schema, study plans, every built-in challenge         |
| `modules/`    | `modules.md`     | modules: schema, resolution, pages, operations, storage, built-in modules |

## Language of the specification

All specification text, identifiers, sentences, and example strings are
English, and English (`en.json`, `en` fields) is the development locale.
Japanese is a translation: it exists only in `src/i18n/ja.json` and in the
`ja` fields of challenge, plan, and module files, and the specification
refers to it by key. Labels quoted in `ui/` are `en.json` texts; `ja.json`
holds the same keys with Japanese texts (`ui/pages.md`, Catalogs).

## Statements

A statement is a paragraph or a table row under a heading. Statements use
the present indicative ("The emitter writes 4-space indentation") and are
mandatory; "may" marks an option. A new statement states one rule that one
test can establish. A statement names no release, schedule, or status, and
records no history.

A statement refers to another by its heading, and by its file as well when
the heading is in another file: (`language.md`, Scope); a reference to a
whole file names the file alone. A handle that the
code, the tests, and the specification share, such as an error code, a
block key, a message key, or a function or type name, stands alone. An
issue, a pull request, or a review finding that points at a statement quotes
its sentence and names its file and heading. Statements carry no numbers: a
quoted sentence reads on its own, and a handle finds the statement, the
code, and the tests in one search, where a numbering would have to be kept
in step with all three.

Each file opens with the code and the tests it governs. A file whose
statements carry a test obligation of their own ends with `Verification`,
which states the obligations only.

## Reasons

A statement carries a reason only where a reader would otherwise plausibly
turn it into an alternative that was rejected, or where it rests on a
constraint that the code, the configuration, and the statement do not show.
The reason stands in the statement's paragraph, or after the table of its
row with the row named, and names that alternative or constraint; it does
not restate the statement, tell how it came about, or defend what a test or
a check already enforces. A changed statement's reason changes with it.

## Terms

| Term            | Definition                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| program         | one `Program` AST (`language.md`)                                               |
| block           | a `NodeDef` in `src/nodes/` and its entry in the block menu (`nodes.md`)        |
| node            | chart rendering of one statement (a box, a diamond, or a terminal)              |
| generated node  | a node the chart draws for a loop's init, check, or step; it belongs to the loop |
| region          | an ordered list of statements inside a branch or loop, or at top level          |
| slot            | one editable field of a block                                                   |
| value line      | the one-line editor of an expression slot (`editor.md`, Value line)             |
| word operation  | an expression written in words around its inputs (`nodes.md`, Node text)        |
| connector       | the `+` insertion point on an edge                                              |
| event           | one record produced by the interpreter (`interpreter.md`)                       |
| step            | one call to `Runner.next()`; a visible step is one the driver stops on (`interpreter.md`, Steps and batches) |
| ref             | a location in the state: variable, list index, dict key, object field           |
| view            | rendering of one variable in the `Result` tab (`views.md`)                      |
| panel           | the left region of a page, holding the `Problem`, `Result`, and `Python` tabs   |
| canvas          | the right region of a page: the path bar, the chart, the narration line, and the run bar (`pages.md`, Page layout) |
| run bar         | the bar at the foot of the canvas holding `Run` and, while running, the run's controls (`run.md`, Run bar) |
| path bar        | the line above the chart naming the chart shown and, while running, the call stack |
| case            | one set of inputs with its expectation: a challenge test, or a module function's saved run (`modules.md`, Cases) |
| challenge       | a JSON file in `challenges/` (`challenges.md`); shown to learners as a problem  |
| study plan      | a named ordered subset of the challenges (`challenges/plans.json`)              |
| module          | a named set of functions and classes stored outside any program (`modules.md`); a program uses it by name |
| built-in module | a module shipped as `modules/<name>.json`                                       |
| learner module  | a module the learner created or copied, kept by the module store (`modules.md`, Storage) |
| artboard        | one screen drawn in Claude Design, exported to `docs/design/`                   |

## Commitments

Three commitments: one small block language that is a Python subset; views
chosen by value type only; generated Python as the reference for behaviour.
