// Solving a problem: open FizzBuzz from the list, load the solution from storage, run it, drag the
// position bar to the end, submit, see Accepted, open the Python tab, and reach the next
// problem. U-80, U-81, U-82, U-83, U-84, U-85, U-86: Wrong Answer and `▶ Watch this case`.
import { expect, test, type Page } from "@playwright/test";
import { seedProgram, seedProgress, solutionOf } from "./seed";

/** Drags the position bar's thumb past its right end. */
async function dragToEnd(page: Page): Promise<void> {
  const bar = page.getByTestId("position");
  const thumb = bar.getByRole("slider");
  const thumbBox = await thumb.boundingBox();
  const barBox = await bar.boundingBox();
  if (!thumbBox || !barBox) throw new Error("the position bar is not drawn");
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(barBox.x + barBox.width + 40, thumbBox.y + thumbBox.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
}

/** FizzBuzz's solution with the loop starting at 0: the first line printed is `FizzBuzz`. */
function fromZero(): Record<string, unknown> {
  const program = solutionOf("fizzbuzz");
  const main = program.main as Array<Record<string, unknown>>;
  const loop = main[0] ?? {};
  loop.start = { id: "fzb-one0-001", kind: "num", value: 0, float: false, raw: "0" };
  return program;
}

test("FizzBuzz from the list to Accepted, Python, and the next problem", async ({ page }) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/");
  await page.getByTestId("problem-fizzbuzz").click();
  await expect(page).toHaveTitle("FizzBuzz — AlgoFlow");
  await expect(page.getByTestId("chart")).toContainText("(remainder of i divided by 15) = 0?");

  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("position")).toBeVisible();
  await dragToEnd(page);
  const text = (await page.getByTestId("position-text").textContent()) ?? "";
  const total = /of (\d+)/.exec(text)?.[1];
  await expect(page.getByTestId("position-text")).toHaveText(`step ${total} of ${total}`);
  await expect(page.getByTestId("narration")).toHaveText(`Finished in ${total} steps`);
  // While running Submit is disabled (U-27).
  await expect(page.getByRole("button", { name: "✓ Submit" })).toBeDisabled();

  await page.getByRole("button", { name: "■ Stop" }).click();
  await page.getByTestId("tab-result").click();
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
  await expect(page.getByTestId("case-chips").locator("[data-chip]")).toHaveText([
    "✓ n = 15",
    "✓ n = 1",
    "✓ n = 3",
  ]);
  await expect(page.getByTestId("steps-loops")).toHaveText(/^Steps \d+ · Loops 15 \(first case\)$/);
  await expect(page.getByTestId("submission")).toContainText("What you used");
  await expect(page.getByTestId("output-row")).toHaveCount(0);

  await page.getByRole("button", { name: "See your program as Python" }).click();
  await expect(page.getByTestId("tab-python")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("python-line").nth(1)).toHaveText("2for i in range(1, n + 1):");

  await page.getByTestId("tab-result").click();
  await page.getByRole("button", { name: "Next problem →" }).click();
  await expect(page).toHaveURL(/#\/p\/max-of-three$/);
  await expect(page).toHaveTitle("Max of three — AlgoFlow");
  const progress = await page.evaluate(() => localStorage.getItem("algoflow:progress"));
  expect(JSON.parse(progress ?? "{}")).toMatchObject({ fizzbuzz: { status: "solved" } });
});

test("Wrong Answer shows the rows only, and Watch opens at the first difference (U-81, U-82)", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", fromZero());
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("tab-result").click();
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Wrong Answer");
  await expect(page.getByTestId("submission")).toContainText("0 of 3 cases passed");
  await expect(page.getByTestId("case-chips").getByRole("button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const first = page.getByTestId("output-row").first();
  await expect(first).toHaveAttribute("data-differs", "true");
  await expect(first).toHaveText("FizzBuzz1");
  await expect(page.locator("[data-current]")).toHaveCount(0);

  await page
    .getByTestId("case-chips")
    .getByRole("button", { name: "✗ n = 1", exact: true })
    .click();
  await expect(page.getByTestId("output-row")).toHaveText(["FizzBuzz1", "1"]);

  await page.getByRole("button", { name: "▶ Watch this case" }).click();
  await expect(page.getByTestId("case-select")).toContainText("n = 1");
  await expect(page.getByTestId("narration")).toHaveText("This printed line 1");
  await expect(page.getByRole("button", { name: "▶ Play" })).toBeVisible();
  await expect(page.getByTestId("submission")).toHaveCount(0);
  await expect(page.getByTestId("output-row").first()).toHaveText("FizzBuzz1");
});

test("a submission is recorded as attempted, and solved only when accepted (C-17)", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", fromZero());
  await page.goto("/#/p/fizzbuzz");
  await page.getByTestId("tab-result").click();
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Wrong Answer");
  const progress = await page.evaluate(() => localStorage.getItem("algoflow:progress"));
  expect(JSON.parse(progress ?? "{}")).toEqual({
    fizzbuzz: { status: "attempted", hints: 0, solution: false },
  });
});

test("after a plan's last problem, Accepted says Plan complete (U-83)", async ({ page }) => {
  const solved = { status: "solved", hints: 0, solution: false };
  await seedProgress(page, {
    tutorial: solved,
    "sum-to-n": solved,
    fizzbuzz: solved,
    "max-of-three": solved,
  });
  await seedProgram(page, "countdown", solutionOf("countdown"));
  await page.goto("/#/p/countdown");
  await page.getByTestId("tab-result").click();
  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
  await expect(page.getByTestId("submission")).toContainText("Plan complete");
  await page.getByRole("link", { name: "Back to Problems" }).click();
  await expect(page.getByTestId("problems")).toBeVisible();
});
