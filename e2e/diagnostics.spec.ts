// A node with a diagnostic shows a red dot; hovering shows the message and its fix.
import { expect, test } from "./fixtures";
import { programWith, seedProgram, seedProgress } from "./seed";

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("hovering a flagged node shows its message, and the fix applies", async ({ page }) => {
  const loop = {
    id: "dgn-loop-001",
    kind: "for",
    var: "i",
    start: { id: "dgn-zero-001", kind: "num", value: 0, float: false, raw: "0" },
    stop: { id: "dgn-stop-001", kind: "num", value: 3, float: false, raw: "3" },
    body: [
      {
        id: "dgn-sets-001",
        kind: "assign",
        target: { kind: "var", name: "total" },
        value: { id: "dgn-ivar-001", kind: "var", name: "i" },
      },
    ],
  };
  const out = {
    id: "dgn-prnt-001",
    kind: "print",
    args: [{ id: "dgn-tvar-001", kind: "var", name: "total" }],
  };
  await seedProgram(page, "fizzbuzz", programWith([loop, out]));
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("diagnostic-dot")).toHaveCount(1);
  await page.locator('[data-chart-node="dgn-prnt-001"]').hover();
  const card = page.getByTestId("diagnostic-card");
  await expect(card).toContainText("Create total before the if or loop");
  await card.getByRole("button", { name: "Create total before it" }).click();
  await expect(page.getByTestId("diagnostic-dot")).toHaveCount(0);
  await expect(page.getByTestId("chart")).toContainText("Create total and set it to none");
});

test("an empty slot shows no dot, only its placeholder", async ({ page }) => {
  const assign = {
    id: "dgn-asg0-001",
    kind: "assign",
    target: { kind: "var", name: "x" },
    value: { id: "dgn-emp0-001", kind: "empty" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("chart")).toContainText("choose a value");
  await expect(page.getByTestId("diagnostic-dot")).toHaveCount(0);
});
