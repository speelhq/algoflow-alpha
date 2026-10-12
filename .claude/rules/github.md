---
paths:
  - ".github/ISSUE_TEMPLATE/**"
  - ".github/pull_request_template.md"
---

# Issues and pull requests

- An issue's body takes the sections of its kind's template (its `about` line says when the
  kind applies), since no tool applies a template; it takes the template's label, and the
  release that takes it as its milestone, if any. A section that does not apply says `None`
  and why, as an omitted one reads like a forgotten one.
- A problem's title states the problem as a fact; a task's title names the work. The title
  and the Summary state it in words, and the Spec section quotes each statement with its
  file and heading.
- A problem idea is an issue labelled `challenge` that names the study plan it joins, with
  no milestone until a release takes it.
- A pull request's body follows `.github/pull_request_template.md` (`/issue`, Finish).
