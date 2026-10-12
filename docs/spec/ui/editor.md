# Editor

Code: `src/ui/editor` (the block menu `menu.ts` and `BlockMenu.tsx`, the
node editor `NodeEditor.tsx` with its session `session.ts`, the value line
`line.ts` and `ValueLine.tsx`, names `names.ts`, the explanation line
`explain.ts`). Tests: beside each file, and `e2e/`.

## Block menu

The block menu lists the registered statement blocks (blocks of
`shape: "stmt"` and the method statements, `nodes.md`, not `hidden`) with a
search over `label` and `help`, grouped in the category order of `nodes.md`,
The block definition (`Basic`, `Control`, `List`, `Function`, `Dict`,
`Class`), each category in a fixed order that puts `assign`, `print`, `if`,
`for`, and `while` first in theirs; an entry reads as the block's template
with every slot as `…` (`set … to …`, `print …`); a block whose `requires`
the connector does not meet is listed disabled with the reason
(`menu.requires.loop`, `menu.requires.function`). The `Function` category
ends with `New function…`, which prompts for a name, creates the function,
and inserts a call to it. Then follow the program's own functions under
`This program`, when any exist, and a last row `Modules ▸` opening one group
per module (`modules.md`, Resolution) titled by its name or title, learner
modules before built-in ones, each listing its functions as calls. Choosing
an item inserts it and opens its editor. Expression blocks are not in this
menu; value lines offer them (Value list). A block that cannot go at the
connector is disabled rather than hidden, which says that it exists and
where it applies. Restricting the menu per challenge was rejected: it hides
the language and adds authoring work. The modules sit behind one
`Modules ▸` row so as not to overfill a trainee's menu, and the categories
run Basic, Control, List because a beginner needs `if` and `for` before list
blocks.

The block menu's `This program` and the value list's `Your functions` list
only the program's functions a call can name: a function whose name a
diagnostic refuses is left out, and the diagnostic on its `Start` node says
why (`chart.md`, Editing on the chart): a row for a function named `for` or
`abs` would insert a call that validation refuses, or a call of the
builtin.

## Node editor

The node editor is a popover on the right of the selected node, within the
canvas, so the panel stays readable while a block is edited: where the
canvas lacks room on the node's right, the canvas scrolls the chart left by
what is missing while the editor is open, and the editor moves down or up
only as far as it must to stay within the canvas; clicking a slot drawn on
the node opens the editor with that slot focused. The editor is drawn at
100 % whatever the chart's zoom; in-node editing was rejected, as the chart
is fitted to its width, a diamond has little room, and a value being built
needs space at full size. Placed against the viewport, the editor would
flip over the panel and hide the statement the learner builds from, and
turned below or above the node it would cover the nodes built from.

From top to bottom the editor holds the node's name field (Node names),
with `Duplicate` and `Delete` as icon buttons beside it and, when the node
calls a function or constructs a class, `Open <name>`, which shows that
function's or class's chart (`chart.md`, Charts and the path bar) or, for a module's, opens its
Module page (`modules.md`, Operations); the block's sentence with its slots
editable in place: `id` and `target` slots as name fields (Name fields),
`expr` slots as value lines (Value line), an optional `expr` slot left
empty as `+ value` (`editor.addValue`), which adds its value line, `exprs`
slots as value lines separated by commas, each with a remove button
(`editor.removeValue`), followed by `+ value`, which adds one, `body` slots
not shown; the list of the focused slot (Value list, Name fields); and the
explanation line (Explanation line). A separator divides each of the name
field, the sentence, and the list from the next. The slot clicked on the
node, or a first slot still to fill, takes the keyboard when the editor
opens; otherwise the keyboard stays with the chart, so Delete removes the
node (`chart.md`, Editing on the chart). An edit applies at once; Esc or a
press outside the editor closes it.

The editor is placed by its node without a control on the node: nothing
there takes the keyboard or announces a popup.

A field of the editor's sentence is named, for assistive technology, by the
template's words just before it, else by the block's label: `set` names the
variable of `set … to …` and `to` its value. A slot's own name (`target`,
`args`) is an identifier of the code, in no catalog, while the template's
words are what a learner reads before the field.

A loop's editor edits the variable and the bounds (`for`), the list
(`foreach`), or the condition (`while`); the generated nodes (`chart.md`,
Shapes) follow.

## Value line

A value line edits one expression, written as the chart writes it
(`nodes.md`, Node text): variables as bold words in the variable colour, an
operator as its symbol, a word operation on a light underlay over its
extent, and an input still to fill as an empty field. A chip editor was
rejected: it nests a box per operation, so a value of three operations is
three levels of boxes, where a line reads left to right as the chart writes
it.

Typed digits make a number, and a `-` typed at an empty input before them a
negative one; a digit or `.` that would make a number Python rejects (`07`,
`1..`), or that follows a value other than a number, is not taken. The sign
is typed rather than chosen from a group, as `found = -1` is the commonest
negative a learner types; the parser reads it as the negation of `1`, as
Python does, so `-3 ** 2` keeps Python's meaning.

A typed word, a letter or `_` followed by letters, digits, and `_`, matches a
name one of whose words starts with it, or an entry's keys (`multiply` finds
`×`, `%` finds `Remainder`): where a value is expected, the visible
variables and the entries offered there, and after a value, every entry that
takes one. While it is unfinished its matches replace the list's groups, a
whole name first and, after a value, the entries for its kind first; Enter
or a click chooses the highlighted match, and ↑ and ↓ move the highlight. A
space or any key of the key table (Backspace and keys) ends the word: when it
names a variable or an entry exactly, that is chosen and the key then
applies; otherwise the key is not taken and the word stays to be corrected.
Tab chooses a word that names one exactly before it moves on. A word that
matches nothing is underlined, and the explanation line names the closest
variable or entry, one that differs by at most one letter in three, and at
least one (`editor.didYouMean`: `Did you mean total?`). A match inside a
word (`i` in `first`) is never the name meant, and Enter takes the first
match, so the kind's entries come first (`an` after a comparison is `And`).
A word that names nothing holds the key typed after it, so `totl+` does not
become a `+` with nothing before it. `Did you mean` allows one letter in
three, as two letters on a short word reach unrelated names (`totl` and
`Not`).

A text is entered only through the list's `Text`, which places a text field
in the line where the text is typed without quotes; Enter, Tab, or leaving
the field ends it, so no quote is typed and none can be left out.

A digit that would make an int outside the int range (`language.md`,
Run-time values), or a float beyond the largest float, is not taken
(`parser.md`).

A value line takes the keys typed without Ctrl or Cmd, and the characters
AltGr makes; every other key acts as the keyboard table (`pages.md`,
Keyboard) states, as it does outside the editor: unlike a text field, a value
line edits the program at each key, so its undo is the program's. AltGr is
how several keyboard layouts type `[` and `{`.

An empty required input is an empty field in the value line and a dashed
`choose a value` on the node, at any depth of the value; clicking it on the
node opens the editor focused on it. An empty name slot is drawn with the
same placeholder; an `exprs` slot with no item draws nothing unless it is
required; a diamond whose condition is empty shows the placeholder without
`?`. A value line that is one empty field reads `type or choose`
(`editor.typeHint`) while it does not have the keyboard.

## Value list

The list of a value line holds groups chosen by what is before the caret.
Where a value is expected: `Variables` (the variables visible at the node,
most recently assigned first, each with its kind, `language.md`, Kinds),
`Values` (the entries of group `values`: `Text`, `True`, `False`, `None`,
`Empty list`, `Empty dict`), `Conditions` (`Not`), `Calculate`
(`Random whole number`, then `( )`, a pair of brackets, labelled
`editor.brackets`), and `Your functions` (the program's own functions as
calls, each labelled `name(…)`, or `name()` with no parameter, and explained
by `editor.ownFunction`, and last `Modules ▸`, which opens one group per
module listing its functions as calls, as the block menu's does). After a
value, the entries whose `on` holds the kind of the expression before the
caret, the largest operation with a precedence that ends at the caret
within the innermost brackets (`nodes.md`, Menu entries): `Calculate` for a
number, `Conditions` for a true/false value, `Items` for a list, a dict, or
an object, and `Compare` and `Convert` for every kind; an entry with a
symbol shows it before its name (`× Multiply`). After a value of no known
kind every entry that takes a value is listed. The groups are always in the
order `Variables`, `Values`, `Conditions`, `Calculate`, `Items`, `Compare`,
`Convert`, `Your functions`, and a group with no row is not shown. The list
scrolls and ends with `Show all`, which lists in that order every entry
that can be chosen there: where a value is expected every entry, and after
a value every entry that takes one. Hovering a row highlights it, and a list
with no row reads `editor.noItems`. Groups are named by what is done with a
value, not by block category; `Combine`, `Other`, `Totals`, `Order`, and
`Functions` were rejected as names that mislead or head one or two rows.
`Variables` offers no `v + 1`: guessing it for an index or a bound would tie
the list to two block kinds (`nodes.md`, The block definition).

An entry chosen after a value takes that value as its first input: an
entry whose block has a precedence (an operator, and `Remainder`,
`Whole-number quotient`, `Power`, `Is in a list`) stands between the value
before the caret and the next one, and binds by the precedence of
`emitter.md` within the innermost brackets; any other entry takes the
expression before the caret whose kind chose the list, so `i < n` followed
by `As text` gives `(i < n) as text`. An entry chosen where a value is
expected fills that input. The inputs a choice leaves appear as fields in
the line and the caret moves to the first of them; Tab and Shift+Tab move
between the fields of the line and, past its last or first field, to the
next or previous slot of the sentence, and → at the end of an operation's
last input leaves the operation; while no word is typed, ← and → move the
caret to the previous or next value or input, and brackets left behind
close; a click on a value puts the caret after it, and on an input at it. A
slot entered by Tab, or open when the editor opens, has its value selected:
a value typed (a digit, a word, a `-` sign, or a bracket) replaces it,
Backspace removes it, and a key that names an entry after a value takes it
as its first input (`n` selected, `*` gives `n × …`). An entry that takes a
value, chosen where a value is expected, fills the input with its operation
and the caret moves to its first input. A call of a function with no
parameter, a variable, or a value fills the input it is chosen for. A value
is built left to right, as it is typed and read; choosing `abs` first and
rebuilding the value inside it would cost two steps for one thought. An
entry with no precedence takes the expression the list was chosen for,
since the list offered `As text` after `i < n` for the comparison, and
applying it to `n` alone would fail when run. A selected value is replaced
by what is typed because a slot reached by Tab already holds one, `0` in a
new `for`, which a caret after it would extend (`01`).

## Backspace and keys

Backspace removes what is before the caret: the last digit of a number, a
value, or an operator; on the words of an operation it removes the
operation and keeps its first input in its place; at an operation's first
input still to fill while a later input holds a value, it removes nothing
and moves the caret left; at a later input still to fill, it removes the
operation and keeps its first input when no input after the first holds a
value, and otherwise removes nothing and moves the caret to the end of the
input before it. Delete removes a selected value as Backspace does.
Clicking an operator in the line lists the other entries of its block in
its group, and choosing one replaces it (`<` to `≤`, `+` to `Remainder`).
Removing the operation also removes the values of its other inputs, so
Backspace removes it only when no input after the first holds a value
(`f(a, b, …)` keeps `b`).

Keys typed in a value line insert what the chart writes; each entry names
its keys (`keys`, `nodes.md`, Menu entries):

| Typed                   | Inserts                                          |
| ----------------------- | ------------------------------------------------ |
| `+` `<` `>`             | as typed                                         |
| `-`                     | `−`; at an empty input, the sign of what follows |
| `*` `/`                 | `×` `÷`                                          |
| `==` `!=` `<=` `>=`     | `=` `≠` `≤` `≥`                                  |
| `(`                     | a pair of brackets, the caret inside them         |
| `[` `,`                 | a list's pair of brackets; `,` between its items  |
| `,` in an `exprs` slot  | the next value of the slot (Node editor)         |
| `%` `//` `**`           | Remainder, Whole-number quotient, Power          |
| `and` `or` `not` `in`   | And, Or, Not, Is in a list                       |

A single `=` inserts nothing; a comparison typed after a comparison is
refused and the explanation line shows the message of `E_PARSE_CHAIN`. At an
input still to fill, a key that inserts an operation after a value inserts
nothing, `-` aside; `(` opens brackets only there, and `)` closes the
innermost open pair. `**` and `//`, typed as two keys, become one operator
that binds by its own precedence: `2*3**2` multiplies 2 by 3 to the power of
2. A single `=` is Python's assignment, so it is never read as a
comparison; a word operation has a key where Python has one, so the
`Python` tab later shows keys the learner has typed. Brackets are not
stored, so none is ever left unclosed.

## Name fields

An `id` or `target` slot is a name field with a list below it. In `main`
the list holds the names of the `expect.variables` of the challenge's first
test under `This problem`, in that order, then main's other variables under
`Variables`: the inputs and the names assigned in `main`, in program order;
in a function it holds the function's parameters and the names assigned in
its body, under `Variables`. Each name shows its kind (`language.md`,
Kinds). A verdict compares `expect.variables` by name, so a learner who
names `total` differently would fail without a visible reason; offering
the expected names first removes that failure, and fixed common names
(`i`, `count`, `found`) would be read before the names the problem needs.

Typing in a name field keeps the names that begin with the text typed, as a
value line matches a name (Value line), and a typed name that neither holds
and that Identifiers allows (`language.md`) is offered as
`New variable <name>`.

In a name field, choosing a name moves the keyboard to the next slot; ↑ and
↓ move the highlight; Enter chooses the highlighted name, else the name
typed, and in a field not typed in keeps its name and moves to the next
slot, or closes the editor after the last one. A name is set when chosen,
not with every key, which would create `t`, `to`, and `tot` on the way to
`total` and switch the chart between `Create` and `Set` at each one.

A name field keeps only the characters a name may hold (`language.md`,
Identifiers).

In a `target` slot the name list also offers, for a list variable,
`Item at a position` (`Set item … of <list> to …`), and for a dict and an
object variable the key and field forms likewise, as a target is far more
often a variable than an item or a field.

## Node names

Every statement may carry a name in the learner's own words (`language.md`,
Statement names), typed in the editor's name field (`editor.name`,
placeholder `editor.nameHint`: `optional`); the application never
translates it and never asks for it. A named node shows its name alone, in
place of its sentence or its question, unless a slot of it is still empty,
when it shows its sentence with the placeholder; a named counted loop shows
its name on its check, its other generated nodes keeping their text;
hovering a named node shows the sentence, and the `Python` tab writes the
name as a comment above the statement (`emitter.md`). A condition written in
symbols does not say what it is for, which a name in the learner's words
does; a `comment` block was rejected, as it would draw Python's `#` on the
chart.

## Explanation line

The explanation line at the foot of the editor explains what the list
highlights or the caret is in: an entry's name and its help (`nodes.md`,
Catalog keys), which ends with how to type it when keys insert it
(`Type %.`); the brackets' label with `editor.bracketsHelp`; a variable's
name with its kind and the statement that first sets it (`A number
variable. It is first set in: Set i to 1.`, `editor.explain.variablePlain`
when it has no kind), an input's kind (`editor.explain.input`), a parameter
(`editor.explain.parameter`), or, for a name set nowhere yet, that choosing
it creates it (`editor.explain.newVariable`); inside an operation's input,
the operation's name and its template with every input as its value, an
empty one as `…`, and the input the caret is in underlined (`item … of dp`,
its `…` underlined); the message of a refused key (Backspace and keys); the
closest name for a word that matches nothing (Value line), or
`editor.nothingLike` when none is close; in a name field with nothing
highlighted, `editor.explain.name`; or else the block's help
(`node.<key>.help`). An input is shown by its value, not named in words
(`position`), which would need a name for every input of every operation in
every language.

## Verification

The tests of `src/ui/editor` cover the block menu's entries, order, disabled
entries, search, and the functions offered; a value line's typing, keys,
choosing, Backspace, moving, and list; the name list and what a name field
keeps; and the explanation line.
