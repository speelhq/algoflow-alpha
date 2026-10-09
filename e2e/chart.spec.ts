// U-22, U-25, U-30, U-31, U-32, U-33, U-38: the chart, its Input nodes, zoom, path bar, and the
// solution.
import { expect, test } from "@playwright/test";
import { seedProgram, seedProgress, solutionOf } from "./seed";

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("an empty main draws Start, the Input node, and End under a path bar of main", async ({
  page,
}) => {
  await page.goto("/#/p/tutorial");
  const chart = page.getByTestId("chart");
  await expect(chart.locator("[data-chart-node]")).toHaveCount(3);
  await expect(chart).toContainText("Start");
  await expect(chart).toContainText('Input name = "Claude"');
  await expect(chart).toContainText("End");
  await expect(page.getByTestId("path-segment")).toHaveText("main");
});

test("FizzBuzz draws its loop's generated nodes, diamonds as questions, and Yes/No edges", async ({
  page,
}) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  const chart = page.getByTestId("chart");
  for (const text of [
    "Set i to 1",
    "i < n + 1?",
    "Set i to i + 1",
    "(remainder of i divided by 15) = 0?",
  ]) {
    await expect(chart.locator("text", { hasText: text }).first()).toBeVisible();
  }
  await expect(chart.locator("text", { hasText: /^Yes$/ })).toHaveCount(4);
  await expect(chart.locator("text", { hasText: /^No$/ })).toHaveCount(4);
});

test("clicking a node selects its statement and highlights its Python lines", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-prfz-001"]').click();
  await expect(page.locator('[data-chart-node="fzb-prfz-001"]')).toHaveAttribute(
    "data-selected",
    "true",
  );
  await page.getByTestId("tab-python").click();
  await expect(page.locator('[data-testid="python-line"][data-selected]')).toHaveText(
    /print\("Fizz"\)/,
  );
});

test("an Input node lists the cases and choosing one sets it (U-32)", async ({ page }) => {
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("input-node").click();
  await page.getByRole("menuitem", { name: "n = 3" }).click();
  await expect(page.getByTestId("chart")).toContainText("Input n = 3");
});

test("zoom steps and returns to 100 % (U-38)", async ({ page }) => {
  await page.goto("/#/p/fizzbuzz");
  const zoom = page.getByTestId("zoom");
  await expect(zoom).toContainText("100%");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(zoom).toContainText("125%");
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect(zoom).toContainText("80%");
  await page.getByRole("button", { name: "Zoom to 100 %" }).click();
  await expect(zoom).toContainText("100%");
});

test("Show solution draws the solution read-only; Back to my chart returns (U-22)", async ({
  page,
}) => {
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByTestId("chart").locator("[data-chart-node]")).toHaveCount(3);
  await page.getByRole("button", { name: "Show solution" }).click();
  await expect(page.getByTestId("solution-band")).toContainText("Solution");
  await expect(page.getByTestId("connector")).toHaveCount(0);
  await expect(page.getByTestId("chart")).toContainText("(remainder of i divided by 15) = 0?");
  await expect(page.getByTestId("input-node")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to my chart" }).click();
  await expect(page.getByTestId("solution-band")).toHaveCount(0);
  await expect(page.getByTestId("chart").locator("[data-chart-node]")).toHaveCount(3);
});

test("Load into my chart replaces the program with the solution as one undoable edit (U-22)", async ({
  page,
}) => {
  await page.goto("/#/p/fizzbuzz");
  await page.getByRole("button", { name: "Show solution" }).click();
  await page.getByRole("button", { name: "Load into my chart" }).click();
  await expect(page.getByTestId("solution-band")).toHaveCount(0);
  await expect(page.getByTestId("chart")).toContainText("(remainder of i divided by 15) = 0?");
  await expect(page.getByTestId("connector").first()).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("chart").locator("[data-chart-node]")).toHaveCount(3);
});
