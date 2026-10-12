# Language

Code: `src/lang/`: types `types.ts`, validation `validate.ts`, edits
`edit.ts`, data conversion `data.ts`, import `migrate.ts`, traversal
`walk.ts`, scope `scope.ts`, kinds `kinds.ts`. Tests: beside each file.

## Identifiers

A variable, function, parameter, or field name matches
`/^[a-z_][a-z0-9_]*$/`.

A class name matches `/^[A-Z][A-Za-z0-9]*$/`.

No name is in `RESERVED`:

```
False None True and as assert async await break class continue def del elif
else except finally for from global if import in is lambda nonlocal not or
pass raise return try while with yield
list dict set len print range min max sum abs input str int float bool
tuple id type self math random round sorted
```

## Program

```ts
export type Program = {
  version: 1;
  title: string;
  challengeId?: string;
  inputs: InputDecl[]; // empty in Playground (`scope.md`, Curriculum)
  classes: ClassDef[];
  functions: FunctionDef[];
  main: Stmt[];
};
export type InputDecl = { name: Id; kind: Kind };
export type ClassDef = { id: NodeId; name: Id; fields: Field[] };
export type Field = { name: Id; default: Data }; // Semantics, Objects
export type FunctionDef = { id: NodeId; name: Id; params: Id[]; body: Stmt[] };
export type NodeId = string; // 12-char nanoid
export type Id = string;
```

`NodeId` values are unique within a program.

Function names, class names, and input names are unique within a program
and do not collide with each other.

An input declares its name and kind only; its value comes from the chosen
case (`challenges.md`, Schema). A value in the program would be a second
copy of one case, shown by the chart and the `Python` tab while Run used
another.

## Data

`Data` is the JSON form used in program and challenge files.

```ts
export type Data =
  | number // integer → int; fractional or exponent → float
  | { $float: number } // integral float, e.g. 2.0
  | string
  | boolean
  | null
  | Data[]
  | { $cls: string; $id?: number; [field: string]: Data } // object (expectations, module cases, a Module page's arguments)
  | { [key: string]: Data }; // dict; int keys are written "$int:3"
```

`toValue(data, heap)` allocates heap entries for lists, dicts, and objects;
`toData(value, heap)` is its inverse and numbers objects `$id` in
first-reach order. `toValue` allocates one object per distinct `$id`, so
references shared within one value, or across the values converted with
one heap, remain shared, and a cycle ends in `{ $cls, $id }`. A repeated
object is written again in full under its `$id`, not as a reference node,
so two `Data` values compare as they are.

The `Data` of a program or challenge file is canonical: every number is
finite, an integral number lies in the int range (Run-time values), an
integral float is written `{ $float: n }`, and a `$int:` key is an integer
in that range written as Python writes it: `$int:0`, never `$int:-0`. The
two would name one int, as `-0` and `0` do in Python, and a second spelling
of a key either misses a lookup CPython makes or does not convert back to
itself.

`migrate()` rejects, with the path of the fault, a field its block would
not make (`fieldsError`, `nodes.md`) and a class field default that is not
canonical `Data`. The split follows where a fault is fixed:
`validate()` reports what an edit can produce, which the learner fixes on
its node, while a fault only a hand edit makes (an unknown kind, a missing
field, a literal its block would not make, a `Data` value that is not
canonical) has no node to fix it on, so `migrate()` refuses it and
`validate()` never reads a literal field.

While no registered block constructs an object (`new`), a program holds no
class and `Data` no object: `migrate()` rejects a class and an input of the
kind `object`, and `pnpm check` rejects a `$cls` in a challenge file and a
class name in its `defines`, each with the path of the fault. Until then
only a hand-written file holds a class or an object, and reading one would
take code for identity, cycles, constructors, and field defaults that no
learner reaches; refusing it, rather than reading what can be read, keeps a
`$cls` record from passing as a dict.

## Run-time values

```ts
export type Value =
  | { t: "int"; v: number }
  | { t: "float"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "none" }
  | { t: "list"; ref: HeapId }
  | { t: "dict"; ref: HeapId }
  | { t: "obj"; ref: HeapId };
export type HeapId = number;
export type HeapEntry =
  | { kind: "list"; items: Value[] }
  | { kind: "dict"; entries: Map<string, Value> } // "i:3" for int 3, "s:ab" for str "ab"
  | { kind: "obj"; cls: Id; fields: Map<Id, Value> };
export type Heap = Map<HeapId, HeapEntry>;
```

`int` and `float` are distinct.

An `int` is an integer of magnitude at most 2^53 − 1: 2^53 is also what
2^53 + 1 rounds to in a double, so an `int` of 2^53 could be a wrong one
that looks right (`9007199254740991 + 2`). A literal or a `Data` number
beyond it is refused (`parser.md`; Data above), not run as a `float`:
CPython runs the emitted `raw` as the exact int, so the chart, the `Python`
tab, and the run would show three numbers with no message, and
`JSON.parse` rounds a `Data` number before any check sees it.

An operation whose result is an integer outside that range gives a
`float`, a difference from Python the learner can see, where a wrong `int`
would not show.

## Statements

```ts
type S = { id: NodeId; name?: string }; // Statement names
export type Stmt =
  | (S & { kind: "assign"; target: Target; value: Expr })
  | (S & { kind: "delete"; target: IndexTarget | KeyTarget })
  | (S & { kind: "if"; cond: Expr; then: Stmt[]; else: Stmt[] })
  | (S & { kind: "for"; var: Id; start: Expr; stop: Expr; body: Stmt[] })
  | (S & { kind: "foreach"; var: Id; list: Expr; body: Stmt[] })
  | (S & { kind: "while"; cond: Expr; body: Stmt[] })
  | (S & { kind: "break" })
  | (S & { kind: "continue" })
  | (S & { kind: "print"; args: Expr[] })
  | (S & { kind: "return"; value?: Expr })
  | (S & { kind: "expr"; expr: Expr })
  | (S & { kind: "swap"; list: Expr; i: Expr; j: Expr });

export type Target = VarTarget | IndexTarget | KeyTarget | FieldTarget;
export type VarTarget = { kind: "var"; name: Id };
export type IndexTarget = { kind: "index"; list: Expr; index: Expr };
export type KeyTarget = { kind: "key"; dict: Expr; key: Expr };
export type FieldTarget = { kind: "field"; obj: Expr; field: Id };
```

## Expressions

```ts
type E = { id: NodeId };
export type Expr =
  | (E & { kind: "empty" }) // an unfilled slot, below
  | (E & { kind: "num"; value: number; float: boolean; raw: string })
  | (E & { kind: "str"; value: string })
  | (E & { kind: "bool"; value: boolean })
  | (E & { kind: "none" })
  | (E & { kind: "var"; name: Id })
  | (E & { kind: "binop"; op: BinOp; left: Expr; right: Expr })
  | (E & { kind: "unop"; op: "neg" | "not"; operand: Expr })
  | (E & { kind: "index"; list: Expr; index: Expr })
  | (E & { kind: "key"; dict: Expr; key: Expr })
  | (E & { kind: "field"; obj: Expr; field: Id })
  | (E & { kind: "list"; items: Expr[] })
  | (E & { kind: "dict"; entries: Array<{ key: Expr; value: Expr }> })
  | (E & { kind: "new"; cls: Id; args: Expr[] })
  | (E & { kind: "call"; fn: Id; args: Expr[] })
  | (E & { kind: "method"; obj: Expr; name: Id; args: Expr[] });
export type BinOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "//"
  | "%"
  | "**"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "and"
  | "or"
  | "in";
```

`num.raw` is the literal's source text and is what the emitter writes;
`float` is true when `raw` contains `.`, `e`, or `E`.

An unfilled required expression slot holds `{ kind: "empty" }`: `create()`
fills required slots with it, `validate` reports `E_EMPTY_SLOT` with the
slot name, and the emitter writes `...` for it. It is never executed.
`Expr | null` was rejected: it would spread null checks through every block
and the emitter, where an `empty` kind keeps `Expr` a closed union.

## Semantics

Each rule has a test with its example, in the test of the block its
heading names; the rules under Values and the run in
`src/runtime/semantics.test.ts`.

### Operators (`binop`)

| Rule | Example |
| --- | --- |
| `int ∘ int` is `int` for `+ - * // % **` (non-negative exponent); `/` is `float` | `7 // 2 → 3`, `4 / 2 → 2.0` |
| any `float` operand → `float` | `1 + 2.0 → 3.0` |
| `//` floors; `%` takes the divisor's sign | `-7 // 2 → -4`, `-7 % 2 → 1` |
| division or modulo by zero → `E_DIV_ZERO` | `1 / 0` |
| `0` or `0.0` to a negative power → `E_DIV_ZERO` | `0 ** -1` |
| `+` on two `str` concatenates; `str` with a number → `E_TYPE` | `"a" + "b" → "ab"` |
| ordering between a number and a `str` → `E_TYPE` | `1 < "a"` |
| `==`: numbers by value (`1 == 1.0`), a `bool` and a number as `0` or `1` and the number, strings by value, lists and dicts structurally, objects by identity | `True == 1 → True` |
| `and` / `or` short-circuit and return the deciding operand | `0 or 5 → 5` |
| `in`: list membership by `==`; dict key membership; `str` substring | `"bc" in "abcd" → True` |

`==` takes a `bool` as Python does although arithmetic and ordering refuse
one (`interpreter.md`, Errors): `==` and `in` never fail, so a stricter `==`
would answer differently from the emitted Python with no message.

### Loops (`for`, `foreach`)

| Rule | Example |
| --- | --- |
| `for` iterates `start … stop-1`, bounds evaluated once, `int` only else `E_TYPE` | |
| `foreach` visits `list[0]`, `list[1]`, … and reads the list's length before each pass, as Python does, so changing the list inside the loop changes the passes | appending in the body adds a pass |

`foreach` reads the live list, not a snapshot, which would run a body that
changes the list differently from the emitted Python with no sign of it;
every other difference from Python is stricter and ends in an error (a
`bool` is not a number, recursion stops at 200, `E_DECLARE_FIRST`).

### Lists (`swap`, `method:copy`)

| Rule | Example |
| --- | --- |
| `swap` exchanges `list[i]` and `list[j]` | |
| `copy()` copies one list level | |

### Calls (`call`, `print`, `call:random_int`)

| Rule | Example |
| --- | --- |
| a call of a program function is positional with exact arity (validated); no `return` → `None`; depth > 200 → `E_RECURSION` | |
| `print` joins args with one space using Python `str()`: `True`, `None`, `2.0`, `[1, 2]`, `{'a': 1}`, `Value(data=2.0, grad=0.0, prev=[], op='')` | |
| `random_int(a, b)` (inclusive, `int`) draws from mulberry32 seeded per run | |
| `random_int(a, b)` with `a > b` → `E_EMPTY_RANGE` | `random_int(5, 1)` |
| `random_int(a, b)` with a bound that is no `int` → `E_TYPE` | `random_int(1.0, 2)` |

A bound of `1.0` is refused too: CPython 3.12 and later, which `pnpm check`
requires, raise `TypeError` for any `float` bound.

### Objects (`new`, `field`)

| Rule | Example |
| --- | --- |
| `new C(args)` sets every field to a fresh copy of its default, then assigns args in field order; too many args → `E_ARITY` | |
| `o.f` without field `f` → `E_FIELD` | |
| `v.f` where `v` is no object → `E_FIELD`, with the type name of `v` as `cls` | `n.x` with `n = 3` |
| a field default is a number, string, boolean, `null`, `[]`, or `{}` | |

A value that is no object fails with `E_FIELD`, not `E_TYPE`: the fault is a
field it does not have, and `E_TYPE` would name a second operand where
there is none.

### Values and the run (`src/runtime`)

| Rule | Example |
| --- | --- |
| false values: `0`, `0.0`, `""`, `[]`, `{}`, `None`, `False` | |
| list index is `int`; negative counts from the end; otherwise `E_INDEX` | `[1,2][-1] → 2` |
| dict keys are `int` or `str`, else `E_TYPE`; missing key → `E_KEY` | |
| lists, dicts, objects are references; assignment copies the reference | |
| a run stops with `E_STEP_LIMIT` after 1,000,000 events | |

## Scope

A name is visible from its first `assign` (or `for`/`foreach` variable, or
parameter) to the end of its region and in nested regions.

A name first assigned inside `then`, `else`, or a loop body and referenced
after that frame → `E_DECLARE_FIRST`; the fix inserts
`name = <default of the same type>` before the frame.

Functions see only their parameters and body. Field defaults see nothing.

A `for` or `foreach` variable is assigned by the loop statement in the
region that contains the loop, so it remains visible after the loop; bounds
and the iterated list are read before the variable exists.

`hoistAssign` takes the default from the first assignment to the name
inside the frame: `num` → `0` (or `0.0` when float), `str` → `""`, `bool` →
`False`, `list` → `[]`, `dict` → `{}`; any other value → `None`.

A variable may not take the name of a function, a class, a builtin, or a
module function or class the program uses (below) (`E_DUPLICATE_NAME`); the
parameters of one function are distinct; a function may not take a
builtin's name, whose registry key would shadow it. `count = 0` beside
`def count()` runs in the interpreter, which resolves calls by name, but
fails in CPython.

A `call` or `new` resolves its name in this order: a function or class of
the program, a learner module, a built-in module, a builtin of `nodes.md`;
a program definition shadows every module, and a learner module shadows a
built-in module of the same name (`modules.md`, Schema); a name defined by
two modules the program both uses is `E_DUPLICATE_NAME` on the call.

## Validation

`validate(program): Diagnostic[]`, `Diagnostic = { nodeId, code, params, fix?: "hoistAssign" }`,
run after every edit and before every run.

| Code               | Condition                                                   | params                    |
| ------------------ | ----------------------------------------------------------- | ------------------------- |
| `E_UNDEFINED`      | a name not visible (Scope)                                  | `name`                    |
| `E_DECLARE_FIRST`  | a name first assigned in a frame and read after it (Scope)  | `name`, `frame`           |
| `E_BAD_NAME`       | a name that breaks Identifiers                              | `name`                    |
| `E_DUPLICATE_NAME` | a name taken twice (Program, Scope)                         | `name`                    |
| `E_BREAK_OUTSIDE`  | `break`/`continue` outside a loop                           |                           |
| `E_RETURN_OUTSIDE` | `return` in `main`                                          |                           |
| `E_ARITY`          | wrong argument count                                        | `name`, `expected`, `got` |
| `E_UNKNOWN_CALL`   | unknown function, module function, builtin, method, or class | `name`                    |
| `E_EMPTY_SLOT`     | required slot empty (prevents execution)                    | `slot`                    |
| `E_DEFAULT`        | a field default that Semantics, Objects does not allow      | `field`                   |
| `E_DUPLICATE_ID`   | two nodes share an id (Program)                             |                           |

## Edits

`edit.ts` exports pure functions returning a new `Program`: `insertStmt`,
`moveStmt`, `removeStmt`, `duplicateStmt`, `setSlot`, `setExpr`,
`insertItem` and `removeItem` (an item of an `exprs` slot), `renameName`,
`setStmtName`, `addFunction`, `removeFunction`, `addClass`, `removeClass`,
`setFields`, `setParams`, and `hoistAssign`.

Every edit keeps node ids unique.

A statement position is
`Place = { parent: NodeId | "main"; slot: "main" | "body" | "then" | "else"; index: number }`
(`parent` is `"main"`, a function id, or a frame id); `insertStmt` and
`moveStmt` take one.

`moveStmt` counts `index` in the target region after the moved statement
has been removed, as the drop indicator is computed on the list without the
dragged card.

`hoistAssign(program, frame, name)` takes the id of the frame before which
it inserts the assignment, as `E_DECLARE_FIRST` reports it.

The other edits address nodes by id; `setExpr` takes an item index for
`exprs` slots.

History keeps the last 100 programs for undo and redo; consecutive changes
typed into one field of the node editor form one entry, and opening a
program starts an empty history. A typed value changes the chart with
every key: an entry per key would spend the 100 entries on one word, and an
entry made only on leaving the field would keep the chart behind the
editor.

## Storage

Programs persist to `localStorage` key
`algoflow:program:<challengeId | playground id>` 500 ms after the last
edit, and at once when the browser hides the page; export writes
`<title>.algoflow.json` with the modules the program uses embedded
(`modules.md`, Operations); import validates and migrates by `version`
(`src/lang/migrate.ts`).

The value stored under `algoflow:program:<id>` is the `Program` JSON
itself; loading passes it through `migrate()` and treats a rejected value as
absent, so opening a problem then creates its program (`challenges.md`,
Opening and bundling). A zustand `persist` wrapper was rejected: it does
not suit one key per program, and `migrate()` must check whatever storage
returns.

A restored program takes the `challengeId` and `inputs` of its challenge,
and a Playground program has neither.

A Playground program's id is `play-` followed by a NodeId;
`algoflow:playground` holds `Record<id, { edited: number }>`, the time of
each Playground program's last save in milliseconds since the epoch, and
lists exactly the Playground programs in storage. The time is kept here,
not in `Program`, which would carry a storage concern into every export and
challenge file; the `play-` prefix keeps a Playground id from reading as a
challenge id.

## Statement names

A statement's `name` is the learner's name for its node (`editor.md`, Node
names): one line of text, stored with each run of spaces as one space,
trimmed, and absent when empty; `setStmtName` and `migrate()` store it so,
and `setStmtName` makes each line break a space.

`migrate()` rejects a statement's name that is not one line of text.

A statement's name changes neither validation nor execution.

## Kinds

A kind is what the value list and the name list (`editor.md`, Value list;
Name fields) know of a
value before the program runs: `number`, `text`, `truefalse`, `none`,
`list`, `dict`, or `object`.

An expression's kind comes from its block's `kind` (`nodes.md`), given the
kinds of the expressions inside it; an expression whose kind cannot be told
has none.

A variable's kind is its input's declared kind, else that of the value of
its first assignment in program order, else the kind its loop block
declares (`declares`, `nodes.md`: `number` for a `for` variable); a
parameter and a `foreach` variable have none.

## Verification

The tests of `src/lang` give every validation code a failing and a passing
case, show that every edit keeps node ids unique, and show that `migrate()`
accepts each supported version and rejects a malformed program with the
path of the fault.
