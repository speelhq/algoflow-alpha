// U-23, U-39, U-60, U-61, U-62, U-63, U-65, R-11, R-19: run mode on the pre-running driver.
import { expect, test, type Page } from "@playwright/test";
import { programWith, seedProgram, seedProgress, solutionOf } from "./seed";

/** `step k of N` as numbers. */
async function position(page: Page): Promise<{ k: number; n: number }> {
  const text = (await page.getByTestId("position-text").textContent()) ?? "";
  const [, k, n] = /step (\d+) of (\d+)/.exec(text) ?? [];
  return { k: Number(k), n: Number(n) };
}

/** Runs and pauses at once, so a test starts from a known, early position. */
async function runPaused(page: Page): Promise<void> {
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("position")).toBeVisible();
  await page.getByRole("button", { name: "❚❚ Pause" }).click();
}

test.describe("running FizzBuzz", () => {
  test.beforeEach(async ({ page }) => {
    await seedProgress(page, {});
    await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
    await page.goto("/#/p/fizzbuzz");
  });

  test("Run in the run bar plays, selects Result, and Stop returns (U-60, U-63)", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "▶ Run" }).click();
    await expect(page.getByTestId("case-select")).toContainText("n = 15");
    await expect(page.getByTestId("tab-result")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "❚❚ Pause" })).toBeVisible();
    await expect.poll(async () => (await position(page)).k).toBeGreaterThan(0);
    expect((await position(page)).n).toBeGreaterThan(100);
    await expect(page.getByTestId("narration")).toBeVisible();
    // The play button takes Run's place: Pause, then Play.
    await page.getByRole("button", { name: "❚❚ Pause" }).click();
    await expect(page.getByRole("button", { name: "▶ Play" })).toBeVisible();
    await expect(page.getByRole("button", { name: "▶ Run" })).toHaveCount(0);
    await page.getByRole("button", { name: "■ Stop" }).click();
    await expect(page.getByTestId("position")).toHaveCount(0);
    await expect(page.getByTestId("narration")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "▶ Run" })).toBeVisible();
  });

  test("Expected lines beyond the printed output are muted until the end (U-23)", async ({
    page,
  }) => {
    await runPaused(page);
    const rows = page.getByTestId("output-row");
    const printed = await rows.evaluateAll(
      (all) => all.filter((row) => (row.firstElementChild?.textContent ?? "") !== "").length,
    );
    const muted = page.getByTestId("output-rows").locator("[data-muted]");
    expect(await muted.count()).toBe((await rows.count()) - printed);
    expect(await muted.count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Skip ▶▶" }).click();
    await expect(page.getByTestId("narration")).toHaveText(/Finished in/);
    await expect(muted).toHaveCount(0);
  });

  test("Step and Back move one step; the keys do the same", async ({ page }) => {
    await runPaused(page);
    const { k } = await position(page);
    await page.getByRole("button", { name: "Step ▶|" }).click();
    await expect(page.getByTestId("position-text")).toHaveText(new RegExp(`step ${k + 1} of`));
    await page.getByRole("button", { name: "|◀ Back" }).click();
    await expect(page.getByTestId("position-text")).toHaveText(new RegExp(`step ${k} of`));
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("position-text")).toHaveText(new RegExp(`step ${k + 1} of`));
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("position-text")).toHaveText(new RegExp(`step ${k} of`));
  });

  test("a click sets the breakpoint, Skip pauses there, and a second click clears it", async ({
    page,
  }) => {
    await runPaused(page);
    const fizz = page.locator('[data-chart-node="fzb-prfz-001"]');
    await fizz.click();
    await expect(page.getByTestId("breakpoint")).toBeVisible();
    await page.getByRole("button", { name: "Skip ▶▶" }).click();
    await expect(fizz).toHaveAttribute("data-current", "running");
    await expect(page.getByTestId("narration")).toHaveText('Print "Fizz"');
    await expect(page.getByTestId("variables")).toContainText("i = 3");
    await fizz.click();
    await expect(page.getByTestId("breakpoint")).toHaveCount(0);
  });

  test("the end of the position bar finishes the run, judged against the case", async ({
    page,
  }) => {
    await runPaused(page);
    const slider = page.getByTestId("position").getByRole("slider");
    await slider.focus();
    await page.keyboard.press("End");
    const { n } = await position(page);
    await expect(page.getByTestId("position-text")).toHaveText(`step ${n} of ${n}`);
    await expect(page.getByTestId("narration")).toHaveText(`Finished in ${n} steps`);
    await expect(page.getByTestId("case-verdict")).toHaveText("✓ This case passes");
    await expect(page.getByTestId("output-row")).toHaveCount(15);
    // At the last step the play button replays from step 0.
    await page.getByRole("button", { name: "↺ Replay" }).click();
    await expect(page.getByRole("button", { name: "❚❚ Pause" })).toBeVisible();
    expect((await position(page)).k).toBeLessThan(n);
  });

  test("the speed is one of three, Normal at first, and the narration is a line under the chart", async ({
    page,
  }) => {
    await runPaused(page);
    const speed = page.getByRole("group", { name: "Speed" });
    await expect(speed.getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await speed.getByRole("button", { name: "Fast" }).click();
    await expect(speed.getByRole("button", { name: "Fast" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The narration sits between the chart and the run bar, over no node.
    const line = await page.getByTestId("narration").boundingBox();
    const chart = await page.getByTestId("chart-scroll").boundingBox();
    const bar = await page.getByTestId("run-bar").boundingBox();
    if (!line || !chart || !bar) throw new Error("not drawn");
    expect(line.y).toBeGreaterThanOrEqual(chart.y + chart.height - 1);
    expect(line.y + line.height).toBeLessThanOrEqual(bar.y + 1);
  });

  test("Esc clears the breakpoint first, then stops", async ({ page }) => {
    await runPaused(page);
    await page.locator('[data-chart-node="fzb-prfz-001"]').click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("breakpoint")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("position")).toHaveCount(0);
  });
});

test("while running, the case and the solution stay put (U-27, U-32)", async ({ page }) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await runPaused(page);
  await expect(page.getByTestId("case-select")).toBeDisabled();
  await expect(page.getByTestId("input-node")).toHaveCount(0);
  await page.getByTestId("tab-problem").click();
  await expect(page.getByRole("button", { name: "Show solution" })).toBeDisabled();
  await page.getByRole("button", { name: "■ Stop" }).click();
  await expect(page.getByRole("button", { name: "Show solution" })).toBeEnabled();
});

test("reopening a problem selects its first case again (C-13)", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("input-node").click();
  await page.getByRole("menuitem", { name: "n = 3" }).click();
  await expect(page.getByTestId("chart")).toContainText("Input n = 3");
  await page.getByRole("link", { name: "← Problems" }).click();
  await page.getByTestId("problem-fizzbuzz").click();
  await expect(page.getByTestId("chart")).toContainText("Input n = 15");
});

test("before any run, Result shows the case, its Expected, and Run to see the values", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("tab-result").click();
  await expect(page.getByTestId("result-tab")).toContainText("Run to see the values");
  await expect(page.getByTestId("case-select")).toHaveText(/n = 15/);
  await expect(page.getByTestId("output-row").nth(2)).toHaveText("Fizz");
});

test("Run with a diagnostic leads to its node instead of running (U-60)", async ({ page }) => {
  await seedProgress(page, {});
  const assign = {
    id: "asg-empty-01",
    kind: "assign",
    target: { kind: "var", name: "x" },
    value: { id: "val-empty-01", kind: "empty" },
  };
  await seedProgram(page, "fizzbuzz", programWith([assign]));
  await page.goto("/#/p/fizzbuzz");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("node-editor").getByRole("alert")).toContainText("is empty");
  // Once the slot is filled the message is gone.
  await page.getByTestId("node-editor").locator("[data-value-line]").click();
  await page.keyboard.type("1");
  await expect(page.getByTestId("node-editor").getByRole("alert")).toHaveCount(0);
  await expect(page.locator('[data-chart-node="asg-empty-01"]')).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.getByTestId("position")).toHaveCount(0);
});

test("a run that never ends reports it before playback (U-60)", async ({ page }) => {
  await seedProgress(page, {});
  const loop = {
    id: "whl-endless1",
    kind: "while",
    cond: { id: "cnd-endless1", kind: "bool", value: true },
    body: [],
  };
  await seedProgram(page, "fizzbuzz", programWith([loop]));
  await page.goto("/#/p/fizzbuzz");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("endless")).toBeVisible({ timeout: 30_000 });
});
