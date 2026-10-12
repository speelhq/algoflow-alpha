---
name: add-node
description: Add a block to src/nodes with interpreter, Python emission, i18n keys, and tests per docs/spec/nodes/nodes.md. Use when asked to add, implement, or support a block, builtin, or method.
argument-hint: [block key or description]
allowed-tools: Bash(pnpm test *) Bash(pnpm lint)
---

Add the block described in $ARGUMENTS.

1. Read `docs/spec/nodes/nodes.md` and find the block's row; read the
   Semantics heading of `docs/spec/language/language.md` that names the
   block, if one does. A block with no row is a choice the spec does not
   cover: propose the row (`CLAUDE.md`, Judgement) and wait; once agreed,
   the row, with its reason where `docs/spec/README.md`, Reasons asks for one, is
   committed before any code.
2. Read `src/nodes/registry.ts` and one existing block of the same shape.
3. Create `src/nodes/<key>.ts` exporting the block's `NodeDef` with the fields
   of `nodes.md`, The block definition, that the block needs. The emitted
   Python equals the row's Python column exactly.
4. Add `node.<key>.label`, `node.<key>.template`, `node.<key>.help` to
   `src/i18n/en.json`, and to `ja.json` if that file exists (`nodes.md`,
   Catalog keys); a named menu entry adds `node.<key>.<name>.label` and
   `.help`.
5. Register the block in `src/nodes/registry.ts`.
6. Add the tests of `nodes.md`, Verification: the exact emitted Python text,
   the interpreter's event sequence and result, one test per Semantics rule
   under the block's heading, and one test per error code the block can
   raise.
7. Run `pnpm test src/nodes src/python src/runtime` and `pnpm lint`.
8. Recap: key, emitted Python, test files.
