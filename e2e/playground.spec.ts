// U-15, U-01, U-05, U-07, L-53, S-07: Playground programs, their page, persistence,
// Export and Import, and Open in Playground.
import { expect, test } from "./fixtures";
import { seedProgram, seedProgress, solutionOf } from "./seed";

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("New opens an empty program that keeps its title and is listed (U-15, U-01, S-07)", async ({
  page,
}) => {
  await page.goto("/#/play");
  await expect(page.getByTestId("playground")).toContainText("No programs yet");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page).toHaveURL(/#\/play\/play-/);
  await expect(page.getByTestId("program-title")).toHaveValue("Untitled");
  await expect(page.getByRole("link", { name: "← Playground" })).toBeVisible();
  await expect(page.getByRole("button", { name: "✓ Submit" })).toHaveCount(0);
  await expect(page.getByTestId("tab-problem")).toHaveCount(0);
  await expect(page.getByTestId("tab-result")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("input-node")).toHaveCount(0);
  await page.getByTestId("program-title").fill("Squares");
  await expect(page).toHaveTitle("Squares — AlgoFlow");
  await page.reload();
  await expect(page.getByTestId("program-title")).toHaveValue("Squares");
  await page.getByRole("link", { name: "← Playground" }).click();
  await expect(page.getByTestId("playground-row")).toHaveCount(1);
  await expect(page.getByTestId("playground-row")).toContainText("Squares");
});

test("Delete asks first and then removes the program (U-15)", async ({ page }) => {
  await page.goto("/#/play");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("link", { name: "← Playground" }).click();
  await page.getByTestId("playground-row").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("delete-dialog")).toContainText("Delete “Untitled”?");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("playground-row")).toHaveCount(1);
  await page.getByTestId("playground-row").getByRole("button", { name: "Delete" }).click();
  await page.getByTestId("delete-dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("playground-row")).toHaveCount(0);
});

test("Export writes the program, and Import adds it back; a bad file adds nothing (L-53)", async ({
  page,
}) => {
  await page.goto("/#/play");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByTestId("program-title").fill("Squares");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("Squares.algoflow.json");
  const text = await (await file.createReadStream()).toArray();
  const exported = Buffer.concat(text).toString("utf8");
  expect(JSON.parse(exported)).toMatchObject({ version: 1, title: "Squares", main: [] });

  await page.getByRole("link", { name: "← Playground" }).click();
  await page.getByTestId("import-file").setInputFiles({
    name: "Squares.algoflow.json",
    mimeType: "application/json",
    buffer: Buffer.from(exported),
  });
  await expect(page.getByTestId("playground-row")).toHaveCount(2);
  await page.getByTestId("import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not a program"),
  });
  await expect(page.getByRole("alert")).toContainText("not an AlgoFlow program");
  await expect(page.getByTestId("playground-row")).toHaveCount(2);
});

test("a Playground route the Playground does not list shows Problems (U-07)", async ({ page }) => {
  await page.goto("/#/play/play-zzzzzzzzzzzz");
  await expect(page.getByTestId("problems")).toBeVisible();
});

test("Open in Playground carries the inputs as assignments, and its ⋯ holds Help alone (U-05, U-01)", async ({
  page,
}) => {
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Open in Playground" }).click();
  await expect(page).toHaveURL(/#\/play\/play-/);
  await expect(page.getByTestId("program-title")).toHaveValue("FizzBuzz");
  await expect(page.getByTestId("chart")).toContainText("Create n and set it to 15");

  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["Help"]);
});

test("an edit on a problem is saved and restored on reload (L-53)", async ({ page }) => {
  await page.goto("/#/p/fizzbuzz");
  await page.getByRole("button", { name: "Add your first block" }).click();
  await page.getByTestId("block-menu").locator('[data-entry="print"]').click();
  await expect(page.getByTestId("chart")).toContainText("Print choose a value");
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByTestId("chart")).toContainText("Print choose a value");
});
