---
paths:
  - "src/ui/**"
---

# The screens

Before changing a screen, read `docs/spec/ui/` (the file of the screen, and `pages.md`), and
before building one, `docs/design/README.md` and the screen's artboard, the exported PNG:
the Claude Design files open only for the people they are shared with and cannot be
reviewed or diffed in a pull request.

- oxlint: `jsx-a11y` rejects mouse and click handlers on `li`/`tr`/`ol` (use one delegated
  listener with `data-*`); `react/set-state-in-effect` rejects `setState` inside effects
  (adjust state during render).
- No React Testing Library: unit tests cover stores, `t()`, script logic, and the editor's
  behaviour as pure session steps (`src/ui/editor/session.ts`), and Playwright exercises
  components end to end, so a DOM testing library would be a second, slower means.
- `src/ui/primitives` holds shadcn components generated on Base UI (`pnpm dlx shadcn add …`);
  everything else under `src/ui/` is hand-written. A generated file is regenerated, never
  edited, except that `shadcn add` writes `import { cn } from "cn"` and adds an npm package
  `cn`: correct the import to `@/lib/utils` and revert `package.json` and the lockfile.
- A chart can be inspected without a screen: write `layout()`'s result as SVG from a
  temporary Vitest file and capture a screenshot with Playwright.
