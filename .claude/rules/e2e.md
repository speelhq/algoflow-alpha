---
paths:
  - "e2e/**"
  - "playwright.config.ts"
---

# The end-to-end tests

The specs they check are in `docs/spec/ui/`; the screenshot suite is stated in `pages.md`,
Verification.

- The suite runs against `dist/`, so build first.
- The tests load a finished program through storage (the restore path of
  `docs/spec/challenges/challenges.md`, Opening and bundling). Building each through the
  `+` menu would make every test of running or submitting depend on the editor, which the
  editing tests cover, and a development-only hook for loading would be UI no test covers.
