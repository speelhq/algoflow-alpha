// Playground programs, their page, running one, persistence, Export and Import, and Open in Playground.
import { expect, test } from "./fixtures";
import { programWith, seedPlayground, seedProgram, seedProgress, solutionOf } from "./seed";

test.beforeEach(async ({ page }) => {
  await seedProgress(page, {});
});

test("New opens an empty program that keeps its title and is listed", async ({ page }) => {
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

test("a Playground program runs to its output, with no case selector and no Expected", async ({
  page,
}) => {
  const id = "play-sayhello0001";
  const say = {
    id: "pgr-prnt-001",
    kind: "print",
    args: [{ id: "pgr-text-001", kind: "str", value: "hi" }],
  };
  await seedProgram(page, id, { ...programWith([say]), title: "Say hi" });
  await seedPlayground(page, { [id]: { edited: 0 } });
  await page.goto(`/#/play/${id}`);
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByTestId("narration")).toHaveText(/Finished in/);
  await expect(page.getByTestId("output-row")).toHaveText(["hi"]);
  await expect(page.getByTestId("case-select")).toHaveCount(0);
  await expect(page.getByTestId("result-rows")).not.toContainText("Expected");
});

test("Delete asks first and then removes the program", async ({ page }) => {
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

test("Export writes the program, and Import adds it back; a bad file adds nothing", async ({
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

test("a Playground route the Playground does not list shows Problems", async ({ page }) => {
  await page.goto("/#/play/play-zzzzzzzzzzzz");
  await expect(page.getByTestId("problems")).toBeVisible();
});

test("Open in Playground carries the inputs as assignments, and its ⋯ holds Help alone", async ({
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

test("an edit on a problem is saved and restored on reload", async ({ page }) => {
  await page.goto("/#/p/fizzbuzz");
  await page.getByRole("button", { name: "Add your first block" }).click();
  await page.getByTestId("block-menu").locator('[data-entry="print"]').click();
  await expect(page.getByTestId("chart")).toContainText("Print choose a value");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("algoflow:program:fizzbuzz")))
    .toContain('"kind":"print"');
  await page.reload();
  await expect(page.getByTestId("chart")).toContainText("Print choose a value");
});
