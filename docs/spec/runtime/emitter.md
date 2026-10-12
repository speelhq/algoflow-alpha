# Emitter

Code: `src/python/emit.ts`, `strings.ts`, `precedence.ts`. Tests:
`emit.test.ts`, with the expression fixture `fixtures/expressions.ts`.

`emit(program, inputs: Record<Id, Data>, modules: Module[]): { code: string; map: Record<NodeId, { start: number; end: number }>; modules }`
returns the program's file and its line map, 1-based inclusive lines; a
frame maps to its header line; `else:` is unmapped.

Python is the only generated language. JavaScript, considered with Dart,
has no int/float distinction, makes `-7 % 2` `-1`, has no `//`, and tests
indices with `in` on an array, so its output would differ from the chart or
wrap arithmetic in helpers a learner cannot read; a second language would
first need a narrower block language or those helpers.

File layout (sections only if non-empty; one blank line between sections,
two around classes and functions): the `import` lines, then one
`from <name> import a, b` line per module the program uses
(`modules.md`, Resolution), modules in name order and names in first-use
order, then classes, functions, and one section of the inputs followed by
`main`.

```python
import random
from heap import heap_push, heap_pop

class Value:
    ...

def backward(root):
    ...

nums = [5, 3, 1, 4, 2]
n = len(nums)
for i in range(n - 1):
    for j in range(n - 1 - i):
        if nums[j] > nums[j + 1]:
            nums[j], nums[j + 1] = nums[j + 1], nums[j]
print(nums)
```

Inputs are emitted as assignments of their values in `inputs`, in
declaration order.

4-space indentation, no trailing whitespace, one trailing newline.

Parentheses only when a child's precedence is lower than its parent's, or
equal on the right of a left-associative operator (`**` is
right-associative; comparisons and `in` are non-associative, so an equal
child on either side is parenthesized). Precedence low → high: `or`, `and`,
`not`, comparisons and `in`, `+ -`, `* / // %`, unary `-`, `**`.

`num` emits `raw`; `str` emits double quotes with `\\ \" \n \t \r` escaped
and any other control character as `\xNN`; `bool` emits `True`/`False`;
`none` emits `None`.

A statement block's `python()` returns `PyLine[]` where
`PyLine = string | { block: Stmt[] }`; an expression block's returns text.
The emitter indents a block by one level, writes `pass` for an empty block,
and records the line map while flattening. Blocks receive
`EmitContext = { expr(e): string; operand(e, precedence, side): string; target(t): string; block(stmts): PyLine }`;
`operand` applies the parentheses rule above. Targets are rendered by the
emitter: `name`, `<list>[<index>]`, `<dict>[<key>]`, `<obj>.<field>`. An
`empty` expression emits `...`.

A statement with a name (`language.md`, Statement names) is preceded by the
comment line `# <name>` at its indentation, and its map entry starts at
that line.

`modules` is the modules the program uses (`modules.md`, Resolution), empty
when it uses none, and the returned `modules` is
`Array<{ name: Id; code: string; map: Record<NodeId, { start: number; end: number }> }>`,
one entry per module, each laid out as above without inputs or `main`;
`emit(module)` produces a module's file alone, with its `map`. Inlining a
module's functions into `main.py` was rejected: the `Python` tab would show
one program where the chart shows a program and a module. Calls stay
unqualified (`heap_push(h, x)`), as `heap.push(h, x)` would collide with
the parser's method syntax.

## Verification

A fixture of 200 expressions emits the expected text under the
parentheses rule.
