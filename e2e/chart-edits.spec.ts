// Selecting, removing, duplicating, dragging, undo and redo.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { programWith, seedProgram, seedProgress, solutionOf } from "./seed";

const node = (page: Page, id: string) => page.locator(`[data-chart-node="${id}"]`);

/** Drags a chart node onto the connector of `place`. */
async function drag(page: Page, id: string, place: string): Promise<void> {
  // The chart is laid out again once its font has loaded; drag from where it settles.
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await expect
    .poll(async () => JSON.stringify(await node(page, id).boundingBox()), { intervals: [100] })
    .toBe(JSON.stringify(await node(page, id).boundingBox()));
  const from = await node(page, id).boundingBox();
  const to = await page.locator(`[data-testid="connector"][data-place="${place}"]`).boundingBox();
  if (!from || !to) throw new Error("not drawn");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("Delete removes the selected node, and undo and redo walk it back", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(undo).toBeDisabled();
  await node(page, "fzb-prfz-001").click({ position: { x: 8, y: 20 } });
  await expect(page.getByTestId("node-editor")).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(node(page, "fzb-prfz-001")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(node(page, "fzb-prfz-001")).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(node(page, "fzb-prfz-001")).toHaveCount(0);
  await undo.click();
  await expect(node(page, "fzb-prfz-001")).toHaveCount(1);
  await expect(redo).toBeEnabled();
});

test("undo, redo, and duplicate act while a value line has the keyboard", async ({ page }) => {
  await page.goto("/#/p/tutorial");
  await page.locator('[data-testid="connector"][data-place="main/main/0"]').click();
  await page.getByTestId("block-menu").locator('[data-entry="print"]').click();
  const line = page.getByTestId("node-editor").locator("[data-value-line]");
  const chart = page.getByTestId("chart");
  await expect(line).toBeFocused();
  await page.keyboard.type("1");
  await expect(chart).toContainText("Print 1");
  await page.keyboard.press("Control+z");
  await expect(chart).not.toContainText("Print 1");
  await expect(line).toBeFocused();
  await page.keyboard.press("Control+Shift+z");
  await expect(chart).toContainText("Print 1");
  await expect(line).toBeFocused();
  await page.keyboard.press("Control+d");
  await expect(chart.locator("text", { hasText: "Print 1" })).toHaveCount(2);
});

test("Ctrl+D duplicates the selected node, and Esc clears the selection", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await node(page, "fzb-prfz-001").click({ position: { x: 8, y: 20 } });
  await page.keyboard.press("Control+d");
  await expect(page.getByTestId("chart").locator("text", { hasText: 'Print "Fizz"' })).toHaveCount(
    2,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("node-editor")).toHaveCount(0);
  await expect(page.locator("[data-selected]")).toHaveCount(0);
});

test("a node dragged onto another connector moves there", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  // The tab is chosen first: dnd-kit stops every click for 50 ms after a drop.
  await page.getByTestId("tab-python").click();
  await drag(page, "fzb-prnt-001", "main/main/0");
  // A drop opens no editor.
  await expect(page.getByTestId("node-editor")).toHaveCount(0);
  await expect(page.getByTestId("python-line").nth(1)).toHaveText("2print(i)");
});

test("a drop that takes break out of its loop is refused with a tooltip", async ({ page }) => {
  const loop = {
    id: "drg-loop-001",
    kind: "while",
    cond: { id: "drg-cond-001", kind: "bool", value: true },
    body: [{ id: "drg-stop-001", kind: "break" }],
  };
  await seedProgram(page, "fizzbuzz", programWith([loop]));
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("tab-python").click();
  await drag(page, "drg-stop-001", "main/main/0");
  await expect(page.getByTestId("drop-refused")).toHaveText("This block only works inside a loop");
  await expect(node(page, "drg-stop-001")).toHaveCount(1);
  await expect(page.getByTestId("python-line")).toHaveText([
    "1n = 15",
    "2while True:",
    "3    break",
  ]);
});
