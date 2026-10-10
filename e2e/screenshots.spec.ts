// U-91, U-112: one screenshot per screen state, written to e2e/screenshots/ for review by
// `pnpm screenshots` and under test-results/ by any other run. Drawn at 1280 × 800, the size of
// the boards in docs/design/.
import { expect, test } from "@playwright/test";
import { programWith, seedProgram, seedProgress, solutionOf } from "./seed";

/** Where the screenshot `name` goes: the tracked folder only when snapshots are being updated. */
function shot(name: string): string {
  const info = test.info();
  const asked = info.config.updateSnapshots === "all" || info.config.updateSnapshots === "changed";
  return asked ? `e2e/screenshots/${name}.png` : info.outputPath(`${name}.png`);
}

test.use({ viewport: { width: 1280, height: 800 } });

test("Problems", async ({ page }) => {
  await seedProgress(page, {
    tutorial: { status: "solved", hints: 0, solution: false },
    "sum-to-n": { status: "solved", hints: 0, solution: false },
    fizzbuzz: { status: "attempted", hints: 1, solution: false },
  });
  await page.goto("/#/");
  await expect(page.getByTestId("problems")).toBeVisible();
  await page.screenshot({ path: shot("problems"), animations: "disabled" });
});

test.describe("FizzBuzz", () => {
  test.beforeEach(async ({ page }) => {
    await seedProgress(page, { fizzbuzz: { status: "attempted", hints: 1, solution: false } });
    await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  });

  test("Build", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await expect(page.getByTestId("chart")).toContainText("(remainder of i divided by 15) = 0?");
    await page.screenshot({ path: shot("build"), animations: "disabled" });
  });

  test("Solution", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByRole("button", { name: "Show solution" }).click();
    await expect(page.getByTestId("solution-band")).toBeVisible();
    await page.screenshot({ path: shot("solution"), animations: "disabled" });
  });

  test("Run", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByRole("button", { name: "▶ Run" }).click();
    await page.getByRole("button", { name: "❚❚ Pause" }).click();
    await page.locator('[data-chart-node="fzb-if03-001"]').click();
    for (let pass = 0; pass < 3; pass += 1) {
      await page.getByRole("button", { name: "Skip ▶▶" }).click();
      await expect(page.getByTestId("variables")).toContainText(`i = ${pass + 1}`);
    }
    await expect(page.getByTestId("narration")).toHaveText(
      "Checking (remainder of i divided by 3) = 0",
    );
    await page.screenshot({ path: shot("run"), animations: "disabled" });
  });

  test("Accepted", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByTestId("tab-result").click();
    await page.getByRole("button", { name: "✓ Submit" }).click();
    await expect(page.getByTestId("verdict")).toHaveText("Accepted");
    await page.screenshot({ path: shot("accepted"), animations: "disabled" });
  });

  test("Python tab", async ({ page }) => {
    await page.goto("/#/p/fizzbuzz");
    await page.getByTestId("tab-python").click();
    await page.getByTestId("python-line").nth(5).click();
    await expect(page.locator('[data-chart-node="fzb-if03-001"]')).toHaveAttribute(
      "data-selected",
      "true",
    );
    await page.screenshot({ path: shot("python"), animations: "disabled" });
  });
});

test("Wrong Answer", async ({ page }) => {
  await seedProgress(page, { fizzbuzz: { status: "attempted", hints: 0, solution: false } });
  const program = solutionOf("fizzbuzz");
  const [loop] = program.main as Array<Record<string, unknown>>;
  if (loop) loop.start = { id: "fzb-one0-001", kind: "num", value: 0, float: false, raw: "0" };
  await seedProgram(page, "fizzbuzz", program);
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("tab-result").click();
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Wrong Answer");
  await page.screenshot({ path: shot("wrong"), animations: "disabled" });
});

test("Playground", async ({ page }) => {
  await seedProgress(page, {});
  const programs = [
    ["play-fizzbuzz00001", "FizzBuzz up to 100", "2026-10-07T14:05:00"],
    ["play-squares000001", "Sum of squares", "2026-10-06T18:40:00"],
    ["play-untitled00001", "Untitled", "2026-10-06T09:12:00"],
    ["play-hello00000001", "Hello, everyone", "2026-10-03T16:58:00"],
  ] as const;
  const index: Record<string, { edited: number }> = {};
  for (const [id, title, time] of programs) {
    index[id] = { edited: new Date(time).getTime() };
    await seedProgram(page, id, { ...programWith([]), title });
  }
  await page.addInitScript(
    (value) => localStorage.setItem("algoflow:playground", value),
    JSON.stringify(index),
  );
  await page.goto("/#/play");
  await expect(page.getByTestId("playground-row")).toHaveCount(4);
  await page.screenshot({ path: shot("playground"), animations: "disabled" });
});
