// The Problem page, its panel, and the Problem and Python tabs.
import { expect, test } from "./fixtures";
import { seedProgram, seedProgress, solutionOf } from "./seed";

test.describe("Problem page", () => {
  test.beforeEach(async ({ page }) => {
    await seedProgress(page, {});
  });

  test("opens on the Problem tab with the statement, Example, and cases", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    const tab = page.getByTestId("problem-tab");
    await expect(page.getByTestId("tab-problem")).toHaveAttribute("aria-selected", "true");
    await expect(tab.getByRole("heading", { name: "FizzBuzz" })).toBeVisible();
    await expect(tab).toContainText("Easy");
    await expect(tab).toContainText("Loops");
    await expect(tab.locator("code", { hasText: "Fizz" }).first()).toBeVisible();
    const example = page.getByTestId("example");
    await expect(example).toContainText("Input n = 15");
    await expect(example).toContainText("Buzz");
    await expect(example).toContainText("… 10 more");
    await expect(example).not.toContainText("FizzBuzz");
    await expect(page.getByTestId("cases")).toHaveText("n = 15 · n = 1 · n = 3");
  });

  test("an expected variable shows in Example as name = value", async ({ page }) => {
    await page.goto("/#/p/sum-to-n");
    await expect(page.getByTestId("example")).toContainText("total = 55");
  });

  test("Show next hint reveals one hint per click and records the count", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    const hints = page.getByTestId("hints");
    await expect(hints).toContainText("0 of 3 shown");
    await hints.getByRole("button", { name: "Show next hint" }).click();
    await expect(hints).toContainText("1 of 3 shown");
    await expect(hints.getByRole("listitem")).toHaveCount(1);
    const stored = await page.evaluate(() => localStorage.getItem("algoflow:progress"));
    expect(JSON.parse(stored ?? "{}")).toEqual({
      fizzbuzz: { status: "attempted", hints: 1, solution: false },
    });
    for (let i = 0; i < 2; i += 1)
      await hints.getByRole("button", { name: "Show next hint" }).click();
    await expect(hints.getByRole("button", { name: "Show next hint" })).toBeDisabled();
  });

  test("Show solution is recorded", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByRole("button", { name: "Show solution" }).click();
    await expect(page.getByTestId("problem-tab")).toContainText("shown in the chart");
    const stored = await page.evaluate(() => localStorage.getItem("algoflow:progress"));
    expect(JSON.parse(stored ?? "{}")).toEqual({
      fizzbuzz: { status: "attempted", hints: 0, solution: true },
    });
  });

  test("the panel collapses to a rail and the state persists", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByRole("button", { name: "Collapse the panel" }).click();
    await expect(page.getByTestId("panel")).toHaveAttribute("data-collapsed");
    await expect(page.getByTestId("panel")).toHaveCSS("width", "40px");
    await page.reload();
    await page.getByRole("button", { name: "Expand the panel" }).click();
    await expect(page.getByTestId("problem-tab")).toBeVisible();
  });

  test("⋯ opens Help", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Help" }).click();
    await expect(page.getByTestId("help")).toBeVisible();
  });
});

test.describe("Python tab", () => {
  test("shows the stored program as numbered, coloured lines and selects a node on click", async ({
    page,
  }) => {
    await seedProgress(page, {});
    await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
    await page.goto("/#/p/fizzbuzz");
    await page.getByTestId("tab-python").click();
    const lines = page.getByTestId("python-line");
    await expect(lines.first()).toHaveText("1n = 15");
    await expect(lines.nth(1)).toHaveText("2for i in range(1, n + 1):");
    await expect(lines.nth(1).locator('[data-token="keyword"]').first()).toHaveText("for");
    await lines.nth(3).click();
    await expect(lines.nth(3)).toHaveAttribute("data-selected", "true");
    await expect(lines.nth(1)).not.toHaveAttribute("data-selected");
  });

  test("Copy and Download .py give the shown file", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedProgress(page, {});
    await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
    await page.goto("/#/p/fizzbuzz");
    await page.getByTestId("tab-python").click();
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    const copied = () => page.evaluate(() => navigator.clipboard.readText());
    await expect.poll(copied).toMatch(/^n = 15\nfor i in range\(1, n \+ 1\):\n/);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .py" }).click();
    const file = await downloading;
    expect(file.suggestedFilename()).toBe("main.py");
    const chunks = await (await file.createReadStream()).toArray();
    expect(Buffer.concat(chunks).toString("utf8")).toBe(await copied());
  });
});
