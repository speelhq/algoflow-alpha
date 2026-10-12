# Parser

Code: `src/python/parse.ts`, `number.ts`, `precedence.ts`. Tests:
`parse.test.ts`, `number.test.ts`.

`parse(text, scope): Expr | ParseError` reads one expression and
implements:

```
expr     := or
or       := and ("or" and)*
and      := not ("and" not)*
not      := "not" not | cmp
cmp      := arith (("==" | "!=" | "<" | "<=" | ">" | ">=" | "in") arith)?
arith    := term (("+" | "-") term)*
term     := factor (("*" | "/" | "//" | "%") factor)*
factor   := "-" factor | power
power    := postfix ("**" factor)?
postfix  := atom ("[" expr "]" | "." NAME | "." NAME "(" args ")" | "(" args ")")*
atom     := NUMBER | STRING | "True" | "False" | "None" | NAME
          | "[" args "]" | "{" (expr ":" expr ("," expr ":" expr)*)? "}" | "(" expr ")"
args     := (expr ("," expr)*)?
```

It reads no Python statement: a learner able to type Python does not need
blocks, and as the block language is a strict subset, most pasted Python
would fail without a clear diagnostic; the `Python` tab (`pages.md`, Python
tab) is the way from chart to text.

Number text CPython rejects (`0777`) is `E_PARSE_SYNTAX`; `\xNN` escapes are
decoded. A construct whose block is not in the registry is `E_PARSE_SYNTAX`
at its token, so the registry alone determines what the language accepts;
a grammar-legal form whose block is not registered (`[1, 2]`, `xs[i]`)
would otherwise fail later in `unparse`, `validate`, or `run` with an
unknown-node error instead of a diagnostic.

An int literal outside the int range (`language.md`, Run-time values), and
a float literal beyond the largest float, is `E_PARSE_SYNTAX` at its token,
and `migrate()` refuses it in a stored program by the parser's own rule; a
float beyond the largest is `inf` to Python, which stored JSON would write
as `null`.

`NAME(...)` resolves in the order of `language.md`, Scope: a class or
function of the program, a learner module, a built-in module, a builtin in
`nodes.md` (`random.randint` accepted as an alias), else `E_UNKNOWN_CALL`.

`a.b(...)` resolves to a method in `nodes.md`, else `E_UNKNOWN_CALL`.

Chained comparison → `E_PARSE_CHAIN`; other syntax errors →
`E_PARSE_SYNTAX`; both carry `position`.

`unparse` is the emitter's expression function.

For an expression `e` with no empty slot (`language.md`, Expressions),
`parse(unparse(e))` with the scope of `e`'s program is `e` apart from node
ids, so `unparse(parse(s))` is a fixed point of `parse ∘ unparse`. The
round trip compares expressions, not texts: `a - (b - c)` written as
`a - b - c` parses and writes back unchanged, so only the expression shows
the lost meaning.

## Verification

A property test generates 1,000 expressions and checks the round trip above
on each, and each parse error code has a test.
