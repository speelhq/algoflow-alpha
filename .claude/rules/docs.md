---
paths:
  - "docs/**"
---

# The specification and the artboards

Before changing the spec, read `docs/spec/README.md`: how a statement and its reason are
written and how a statement refers to another. Before changing `docs/design/`, read its
`README.md`.

- Oxfmt skips `docs/` (`.oxfmtrc.json`), whose Markdown is wrapped by hand: it would rewrite
  the TypeScript blocks the spec writes compactly (a union on two lines becomes one member
  per line, aligned comments lose their columns) and unindent a list item's line that
  continues a code span.
