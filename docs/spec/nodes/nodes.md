# Nodes

Code: `src/nodes/`: one file per block, `registry.ts`, `types.ts`,
`categories.ts`. Tests: one `<key>.test.ts` per block, and
`registry.test.ts`.

## The block definition

Every block is one file `src/nodes/<key>.ts` (a `:` in the key becomes `-`
in the file name: `call-abs.ts`, `method-append.ts`) exporting a `NodeDef`:

```ts
export type NodeDef = {
  key: string;
  shape: "stmt" | "expr";
  category: "basic" | "control" | "list" | "function" | "dict" | "class"; // in menu order (`editor.md`, Block menu)
  slots: Slot[];
  params?: Param[]; // builtin and method parameters in order (argument counts below)
  aliases?: string[]; // Python spellings the parser accepts (`parser.md`), e.g. "random.randint"
  imports?: "random"; // `random_int` (Builtin calls)
  precedence?(node: Expr): number; // `emitter.md`; undefined = atom
  loop?: boolean; // its body regions are loop bodies
  requires?: "loop" | "function"; // where the statement may appear (E_BREAK_OUTSIDE, E_RETURN_OUTSIDE)
  hidden?: boolean; // not in the block menu (`empty`, `expr`)
  zeroLike?(node: Expr): Expr; // a literal block's zero of the same type (`hoistAssign`)
  callee?(node: Expr): Callee; // a call-like block's callee and argument count
  create(): Stmt | Expr; // required slots hold `empty` (`language.md`, Expressions)
  run: StmtRunner | ExprRunner; // `interpreter.md`, Blocks
  python(node: Stmt | Expr, ctx: EmitContext): PyLine[] | string; // `emitter.md`: stmt → lines, expr → text
  form?(node: Stmt | Expr, ctx: { creates: boolean }): string; // Node text
  fieldsError?(fields: Readonly<Record<string, unknown>>): FieldFault | undefined; // `language.md`, Data
  text?(node: Stmt | Expr, slot: string): string; // Node text
  kind?(node: Expr, kindOf: (e: Expr) => Kind | undefined): Kind | undefined; // Kinds
  declares?: Kind; // the kind of the variable its `id` slot names (`language.md`, Kinds)
  menu?: MenuEntry[]; // the entries of the value list (Menu entries)
  chart?:
    | { branch: { cond: string; yes: string; no: string } }
    | { check: { cond: string; body: string } }
    | { counted: string }
    | { jump: "exit" | "next" }; // Chart shape
};
export type Param = { name: string; optional?: true }; // `name` as the template writes it
export type FieldFault = { field: string; message: string }; // a stored field no edit writes
export type Callee = {
  name: Id;
  argc: number;
  family: "builtin" | "function" | "class" | "method"; // builtin, method: arity from `params`
};
export type Slot = {
  name: string;
  role: "expr" | "exprs" | "id" | "body" | "target" | "text";
  required?: boolean;
};
export type Kind = "number" | "text" | "truefalse" | "none" | "list" | "dict" | "object"; // `language.md`, Kinds
export type MenuEntry = {
  name: string; // "" for the block's own label and help, else node.<key>.<name>.label / .help
  group: "values" | "conditions" | "calculate" | "items" | "compare" | "convert"; // `editor.md`, Value list
  on?: Kind[]; // offered after a value of these kinds, which it takes as its first input
  preset?: Record<string, unknown>; // slot values set on the block's create() (binop `op`)
  symbol?: string; // shown before the name in the list (`×`)
  keys?: string; // what typed in a value line inserts it (`editor.md`, Backspace and keys)
};
```

An optional parameter is marked by `optional`, not in its name: a mark
such as `n?` would have to be stripped wherever a parameter is looked up by
the name its template writes.

Slot roles: `expr` one expression; `exprs` an ordered list; `id` a name;
`body` a statement region; `target` an assignment target; `text` a literal
field of an expression (`num.value`, `str.value`, an operator), which no
statement has: a statement's literal text would be a comment, which a
node's name replaces (`editor.md`, Node names).

A builtin or method takes from as many arguments as it has parameters not
marked `optional` to as many as it has parameters; `E_ARITY` gives as
`expected` the fewer when too few are passed and the more when too many.

A builtin's `create()` gives it one empty argument per parameter not
marked `optional`.

`src/nodes/registry.ts` registers every block and is the only registry:
every other module reaches a block through it.

No module other than a block's file and the registry's `keyOf` branches on
`kind`, builtin name, or method name: traversal, validation, the block
menu, the value list, and the chart read a block's `slots`, `menu`, and
flags instead.

## Catalog keys

i18n keys per block in `en.json`: `node.<key>.label`, `node.<key>.template`
(the node's sentence with `{slot}` placeholders), `node.<key>.help`. The
template column below is the `en.json` text; `ja.json` provides the same
keys with the same placeholders. A block with a second template form keeps
it under `node.<key>.template<Form>`: `assign.templateCreate`,
`bool.templateFalse`, `unop.templateNot`, `binop.templateMod`,
`binop.templateFloorDiv`, `binop.templatePow`, `binop.templateIn`. A menu
entry with a `name` has `node.<key>.<name>.label` and
`node.<key>.<name>.help`; a help that ends with how to type the entry names
its keys (`Type %.`).

## Statements

The Python column is the exact emitted text; `<x>` denotes an emitted slot.

| key        | category | slots                  | en template                                                                                                         | Python                                                                              |
| ---------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `assign`   | basic    | target, value          | `set {target} to {value}`; when `target` is a variable not visible before it (`language.md`, Scope): `create {target} and set it to {value}` | `<target> = <value>`                                                                |
| `if`       | control  | cond, then, else       | `if {cond}`                                                                                                         | `if <cond>:` … `else:` (else omitted when empty; empty region → `pass`)             |
| `for`      | control  | var, start, stop, body | `for {var} from {start} up to {stop}`                                                                               | `for <var> in range(<stop>):` when start is `num` 0, else `range(<start>, <stop>):` |
| `foreach`  | list     | var, list, body        | `for each {var} in {list}`                                                                                          | `for <var> in <list>:`                                                              |
| `while`    | control  | cond, body             | `while {cond}`                                                                                                      | `while <cond>:`                                                                     |
| `break`    | control  |                        | `stop the loop`                                                                                                     | `break`                                                                             |
| `continue` | control  |                        | `skip to next iteration`                                                                                            | `continue`                                                                          |
| `print`    | basic    | args                   | `print {args}`                                                                                                      | `print(<a>, <b>)`                                                                   |
| `return`   | function | value?                 | `return {value}`                                                                                                    | `return <value>` / `return`                                                         |
| `expr`     | basic    | expr                   | `{expr}`                                                                                                            | `<expr>`                                                                            |
| `swap`     | list     | list, i, j             | `swap items {i} and {j} of {list}`                                                                                  | `<list>[<i>], <list>[<j>] = <list>[<j>], <list>[<i>]`                               |
| `delete`   | list     | target                 | `delete {target}`                                                                                                   | `del <target>`                                                                      |

A new `for` has no variable name: `create()` receives no context, and
filling in the first unused of `i`, `j`, `k` would be a special case.

## Expressions

| key     | category | slots           | en template                                                         | Python                 |
| ------- | -------- | --------------- | ------------------------------------------------------------------- | ---------------------- |
| `num`   | basic    | value           | `{value}`                                                           | `raw`                  |
| `str`   | basic    | value           | `"{value}"`                                                         | double-quoted, escaped |
| `bool`  | basic    |                 | `true` / `false`                                                    | `True` / `False`       |
| `none`  | basic    |                 | `none`                                                              | `None`                 |
| `var`   | basic    | name            | `{name}`                                                            | `name`                 |
| `binop` | basic    | op, left, right | `{left} {op} {right}` (Node text); `remainder of {left} divided by {right}`, `whole-number quotient of {left} divided by {right}`, `{left} to the power of {right}`, `{left} is in {right}` | infix (`emitter.md`) |
| `unop`  | basic    | op, operand     | `−{operand}` / `not {operand}`                                      | `-<x>` / `not <x>`     |
| `index` | list     | list, index     | `item {index} of {list}`                                            | `<list>[<index>]`      |
| `list`  | list     | items           | `[{items}]`                                                         | `[<a>, <b>]`           |
| `key`   | dict     | dict, key       | `{dict} at {key}`                                                   | `<dict>[<key>]`        |
| `dict`  | dict     | entries         | `{ {entries} }`                                                     | `{<k>: <v>, …}`        |
| `field` | class    | obj, field      | `{field} of {obj}`                                                  | `<obj>.<field>`        |
| `new`   | class    | cls, args       | `new {cls}({args})`                                                 | `<Cls>(<args>)`        |
| `call`  | function | fn, args        | `{fn}({args})`                                                      | `<fn>(<args>)`         |

## Builtin calls (`key = "call:<name>"`, shape expr)

| name                         | category | args | en template                                        | Python                                 |
| ---------------------------- | -------- | ---- | -------------------------------------------------- | -------------------------------------- |
| `len`                        | list     | a    | `count of {a}`                                     | `len(<a>)`                             |
| `abs`                        | basic    | x    | `absolute value of {x}`                            | `abs(<x>)`                             |
| `min`, `max`                 | basic    | a, b | `smaller of {a} and {b}` / `larger of {a} and {b}` | `min(<a>, <b>)` / `max(<a>, <b>)`      |
| `sum`                        | list     | a    | `sum of {a}`                                       | `sum(<a>)`                             |
| `str`, `int`, `float`        | basic    | x    | `{x} as text` / `as whole number` / `as decimal`   | `str(<x>)` / `int(<x>)` / `float(<x>)` |
| `random_int`                 | basic    | a, b | `random whole number from {a} to {b}`              | `random.randint(<a>, <b>)`             |

`random_int` adds `import random` (`emitter.md`).

## Methods (`key = "method:<name>"`)

| name     | on   | shape | args       | en template                               | Python                       |
| -------- | ---- | ----- | ---------- | ----------------------------------------- | ---------------------------- |
| `append` | list | stmt  | x          | `append {x} to {a}`                       | `<a>.append(<x>)`            |
| `insert` | list | stmt  | i, x       | `insert {x} at {i} in {a}`                | `<a>.insert(<i>, <x>)`       |
| `pop`    | list | expr  | i?         | `take the last item of {a}` / `take item {i} of {a}` | `<a>.pop()` / `<a>.pop(<i>)` |
| `copy`   | list | expr  |            | `copy of {a}`                             | `<a>.copy()`                 |
| `sort`   | list | stmt  |            | `sort {a} ascending`                      | `<a>.sort()`                 |
| `get`    | dict | expr  | k, default | `{d} at {k} or {default}`                 | `<d>.get(<k>, <default>)`    |
| `keys`   | dict | expr  |            | `keys of {d}`                             | `list(<d>.keys())`           |

Method statements (`append`, `insert`, `sort`) are `expr` statements
wrapping a `method` expression; the block menu lists them as statements.
The `expr` statement block itself is `hidden`: the menu offers it only as
those method statements and as calls (`editor.md`, Block menu).

## Classes

A class is edited in its chart tab as an ordered field table (name,
default as `language.md`, Semantics, Objects allows) with add, remove, and
reorder.

Emitted form:

```python
class Value:
    def __init__(self, data=0.0, grad=0.0, prev=None, op=""):
        self.data = data
        self.grad = grad
        self.prev = [] if prev is None else prev
        self.op = op

    def __repr__(self):
        return f"Value(data={self.data!r}, grad={self.grad!r}, prev={self.prev!r}, op={self.op!r})"
```

`[]` and `{}` defaults use the `None` idiom; other defaults are literals;
`__repr__` lists fields in order (`print`'s rule, `language.md`, Semantics,
Calls).

## Node text

The chart renders every node and every expression from
`node.<key>.template<form>` (Catalog keys) where `form` is
`form(node, { creates })` (`""` for the base template; `assign` → `Create`
when the statement creates its variable, `bool` → `False`, `unop` → `Not`,
`binop` → `Mod`, `FloorDiv`, `Pow`, `In` for `%`, `//`, `**`, `in`).

It renders a `text` slot with `text(node, slot)` (`num` → `raw`; `binop`
`op` → `−` `×` `÷` `=` `≠` `≤` `≥` for `-` `*` `/` `==` `!=` `<=` `>=`),
defaulting to the slot's string value; the hidden `empty` block has the
three catalog keys and its template is the placeholder text of an empty
input (`editor.md`, Value line).

Only `+ − × ÷ ( ) = ≠ < ≤ > ≥` are written as symbols; every other
operation is written in words. An expression whose template for its form
has words outside its placeholders is a word operation: as an operand of an
operator it is put in brackets, and an operator or a word operation inside
a word operation's input is put in brackets
(`(remainder of i divided by 15) = 0`, `item (i + 1) of nums`); an operator
is an expression with a precedence whose template has no words outside its
placeholders, and operators among themselves are parenthesised as the
emitter does (`emitter.md`). The chart keeps to the symbols a learner knows
from school and leaves Python's notation to its tab; `=` only compares,
since setting a variable is always `Set … to`. A word operation beside a
symbol or inside another is ambiguous without its brackets
(`remainder of i + 1 divided by 3`).

A variable is written as a bold word in the variable colour, on the chart
and in the editor, never in a box, which would cut the sentence into
pieces. A node's sentence is drawn with its
first letter capitalised when it begins with a word of its template
(`Set total to 0`) and as written when it begins with a slot
(`i < n + 1?`); the block menu and the editor show the template as written.

## Chart shape

A block with body regions, or one that sends control elsewhere than the
next statement in a loop, declares `chart` (`chart.md`, Shapes): `if`
declares `{ branch: { cond: "cond", yes: "then", no: "else" } }`; `while`
declares `{ check: { cond: "cond", body: "body" } }`, `cond` naming the
slot of the condition its diamond asks; `for` and `foreach` declare
`{ counted: "body" }`; `break` declares `{ jump: "exit" }` and `continue`
declares `{ jump: "next" }`: the edge of each leads where control goes, out
of the innermost loop or into its next pass. The chart renders every other
block as a box with its sentence; the interpreter and emitter are
unaffected by `chart`.

A block that declares `counted` has three more keys, `node.<key>.init`,
`node.<key>.check`, and `node.<key>.step`, the texts of the generated
nodes:

| key       | init                    | check                          | step                        |
| --------- | ----------------------- | ------------------------------ | --------------------------- |
| `for`     | `Set {var} to {start}`  | `{var} < {stop}?`              | `Set {var} to {var} + 1`    |
| `foreach` | `Start at the first item of {list}` | `Is there an item left?` | `Set {var} to the next item` |

## Menu entries

Expression blocks declare the entries of the value list (`editor.md`, Value
list) in `menu`; an entry with `on` is offered after a value of those kinds
and takes it as its first input, and one without `on` fills an input where a
value is expected. Kinds are those of `language.md`, Kinds; `any` below means
every kind. Each block declares its own entries because one block serves
several groups (`binop` is `Add`, `Equals`, and `And`).

| key               | name       | label                   | group      | on                   | symbol | keys  |
| ----------------- | ---------- | ----------------------- | ---------- | -------------------- | ------ | ----- |
| `str`             |            | Text                    | values     |                      |        |       |
| `bool`            | `true`     | True                    | values     |                      |        |       |
| `bool`            | `false`    | False                   | values     |                      |        |       |
| `none`            |            | None                    | values     |                      |        |       |
| `list`            |            | Empty list              | values     |                      |        | `[`   |
| `dict`            |            | Empty dict              | values     |                      |        |       |
| `unop`            | `not`      | Not                     | conditions |                      |        | `not` |
| `binop`           | `and`      | And                     | conditions | truefalse            |        | `and` |
| `binop`           | `or`       | Or                      | conditions | truefalse            |        | `or`  |
| `call:random_int` |            | Random whole number     | calculate  |                      |        |       |
| `binop`           | `add`      | Add                     | calculate  | number, text         | `+`    | `+`   |
| `binop`           | `sub`      | Subtract                | calculate  | number               | `−`    | `-`   |
| `binop`           | `mul`      | Multiply                | calculate  | number               | `×`    | `*`   |
| `binop`           | `div`      | Divide                  | calculate  | number               | `÷`    | `/`   |
| `binop`           | `mod`      | Remainder               | calculate  | number               |        | `%`   |
| `binop`           | `floorDiv` | Whole-number quotient   | calculate  | number               |        | `//`  |
| `binop`           | `pow`      | Power                   | calculate  | number               |        | `**`  |
| `call:abs`        |            | Absolute value          | calculate  | number               |        |       |
| `call:max`        |            | Larger of two           | calculate  | number, text         |        |       |
| `call:min`        |            | Smaller of two          | calculate  | number, text         |        |       |
| `index`           |            | Item at a position      | items      | list                 |        |       |
| `method:pop`      |            | Take the last item      | items      | list                 |        |       |
| `call:len`        |            | Count                   | items      | list, text, dict     |        |       |
| `call:sum`        |            | Sum                     | items      | list                 |        |       |
| `method:copy`     |            | Copy                    | items      | list                 |        |       |
| `binop`           | `join`     | Join with another list  | items      | list                 | `+`    |       |
| `key`             |            | Value at a key          | items      | dict                 |        |       |
| `field`           |            | Field                   | items      | object               |        |       |
| `binop`           | `eq`       | Equals                  | compare    | any                  | `=`    | `==`  |
| `binop`           | `ne`       | Does not equal          | compare    | any                  | `≠`    | `!=`  |
| `binop`           | `lt`       | Less than               | compare    | number, text         | `<`    | `<`   |
| `binop`           | `le`       | At most                 | compare    | number, text         | `≤`    | `<=`  |
| `binop`           | `gt`       | Greater than            | compare    | number, text         | `>`    | `>`   |
| `binop`           | `ge`       | At least                | compare    | number, text         | `≥`    | `>=`  |
| `binop`           | `in`       | Is in a list            | compare    | any                  |        | `in`  |
| `call:str`        |            | As text                 | convert    | any                  |        |       |
| `call:int`        |            | As whole number         | convert    | number, text         |        |       |
| `call:float`      |            | As decimal              | convert    | number, text         |        |       |

`binop` entries preset `op`; `bool` entries preset `value`.

The help of `and` reads that it is true when both sides are, and the help
of `or` that it is true when one side or both are, since in everyday
English "or" often means only one.

## Kinds

The registered blocks give these kinds (`language.md`, Kinds): `num` a
number, `str` a text, `bool` a true/false value, `none` none; `unop` a
true/false value for `not` and a number for `−`; `binop` a true/false value
for a comparison and `in`, for `and` and `or` the kind of both inputs when
they agree, for `+` the kind of both inputs when they agree and are not
true/false, for `*` a list or a text when one input is one, and otherwise a
number; `call:abs`, `call:int`, `call:float`, and `call:random_int` a
number; `call:str` a text; `call:min` and `call:max` the kind of their
first input; `list` a list, `dict` a dict, and `new` an object. Where a rule
gives no kind, the expression has none: a wrong kind would hide the entries
that apply, while no kind lists every entry.

## Verification

Each block has a test asserting its exact Python text (Statements and the
tables after it), one asserting its event sequence and result, one per rule
filed under it in the Semantics of `language.md`, and, where it can fail,
one error case.
