---
paths:
  - "package.json"
  - "pnpm-lock.yaml"
  - ".oxlintrc.json"
  - ".oxfmtrc.json"
  - "tsconfig*.json"
  - "vite.config.ts"
  - "playwright.config.ts"
  - ".github/**"
  - "scripts/**"
  - ".claude/**"
---

# Tooling

`scripts/check.ts` implements `docs/spec/challenges/challenges.md`, Checks, the CPython check
of `docs/spec/runtime/interpreter.md`, and the checks of `docs/spec/ui/pages.md`, Catalogs;
read them before changing it.

- `@types/node` stays on the major of `.node-version`: types from a later major accept APIs
  that CI's Node lacks while every check passes.
- `pnpm lint` type-checks (`--type-check`) and `pnpm build` does not, so each type is
  checked once.
- `pnpm check` is one script that runs the i18n check itself: pnpm appends command-line
  arguments to the end of a script, so a chained second script would receive
  `challenges/x.json`.
