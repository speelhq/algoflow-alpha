// M-04 exit: build FizzBuzz from an empty chart through the + menu and the node editors, by
// typing and choosing in value lines, and submit it to Accepted. U-34, U-40, U-41, U-50, U-51,
// U-52, U-53, U-54, U-93, U-94, U-95, U-96.
import { expect, test, type Page } from "@playwright/test";
import { seedProgram, seedProgress, solutionOf } from "./seed";

const editor = (page: Page) => page.getByTestId("node-editor");
const chart = (page: Page) => page.getByTestId("chart");

// An uncaught error unmounts the page; it fails the test with its own message.
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

/** Inserts the block `entry` at the connector of `place`, returning the new statement's id. */
async function insert(page: Page, place: string, entry: string): Promise<string> {
  await page.keyboard.press("Escape");
  await page.locator(`[data-testid="connector"][data-place="${place}"]`).click();
  await page.getByTestId("block-menu").locator(`[data-entry="${entry}"]`).click();
  await expect(editor(page)).toBeVisible();
  return (await editor(page).getAttribute("data-node")) ?? "";
}

/** Types into whatever has the keyboard, one key at a time. */
async function keys(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
}

/** A print of one text, chosen as Text and typed without quotes. */
async function printText(page: Page, place: string, text: string): Promise<void> {
  await insert(page, place, "print");
  await keys(page, "text");
  await page.keyboard.press("Enter");
  await expect(editor(page).locator("[data-text-field]")).toBeFocused();
  await keys(page, text);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
}

test("M-04 exit: FizzBuzz is built from an empty chart by typing and choosing, and accepted", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/fizzbuzz");
  await expect(page.getByRole("button", { name: "Add your first block" })).toBeVisible();

  const loop = await insert(page, "main/main/0", "for");
  // The variable's name field has the keyboard: a typed name is offered as a new variable.
  await keys(page, "i");
  await expect(editor(page).getByTestId("editor-list")).toContainText("New variable");
  await page.keyboard.press("Enter");
  // The start value is selected: a digit replaces it; Tab reaches the stop.
  await keys(page, "1");
  await page.keyboard.press("Tab");
  await keys(page, "n+1");
  await page.keyboard.press("Enter");
  await expect(editor(page)).toHaveCount(0);
  await expect(chart(page)).toContainText("i < n + 1?");

  const fifteen = await insert(page, `${loop}/body/0`, "if");
  await keys(page, "i%15==0");
  await expect(editor(page).getByTestId("explanation")).toContainText("Equals");
  await page.keyboard.press("Enter");
  await expect(chart(page)).toContainText("(remainder of i divided by 15) = 0?");
  await printText(page, `${fifteen}/then/0`, "FizzBuzz");

  const three = await insert(page, `${fifteen}/else/0`, "if");
  await keys(page, "i%3==0");
  await page.keyboard.press("Enter");
  await printText(page, `${three}/then/0`, "Fizz");

  const five = await insert(page, `${three}/else/0`, "if");
  await keys(page, "i%5==0");
  await page.keyboard.press("Enter");
  await printText(page, `${five}/then/0`, "Buzz");
  await insert(page, `${five}/else/0`, "print");
  await keys(page, "i");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");

  await page.getByTestId("tab-result").click();

  await page.getByRole("button", { name: "✓ Submit" }).click();
  await expect(page.getByTestId("verdict")).toHaveText("Accepted");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("for i in range(1, n + 1):");
  await expect(page.getByTestId("python-code")).toContainText("if i % 15 == 0:");
});

test("the list follows what is before the caret, and a choice after a value takes it (U-52, U-53)", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/sum-to-n");
  await insert(page, "main/main/0", "assign");
  // This problem's names come first (U-94).
  await expect(editor(page).getByTestId("editor-list")).toContainText("This problem");
  await keys(page, "to");
  await expect(editor(page).locator('[data-row="name:total"]')).toBeVisible();
  await expect(editor(page).locator('[data-row="new:to"]')).toBeVisible();
  await page.keyboard.press("Enter");
  const list = editor(page).getByTestId("editor-list");
  await expect(list).toContainText("Variables");
  await expect(list).toContainText("Random whole number");
  await keys(page, "n ");
  await expect(list).toContainText("Calculate");
  await expect(list).not.toContainText("Random whole number");
  await list.locator('[data-row="e:call:str"]').click();
  await expect(chart(page)).toContainText("Create total and set it to n as text");
  // Backspace on the operation's words keeps its first input (U-54).
  await page.keyboard.press("Backspace");
  await expect(chart(page)).toContainText("Create total and set it to n");
});

test("a typed word that names nothing is underlined with the closest name (U-50, U-96)", async ({
  page,
}) => {
  await seedProgress(page, {});
  await page.goto("/#/p/sum-to-n");
  await insert(page, "main/main/0", "print");
  await keys(page, "nn+");
  await expect(editor(page).getByTestId("explanation")).toContainText("Did you mean n?");
});

test("naming a node shows the name on it and as a comment in Python (U-95, E-11)", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  await page.locator('[data-chart-node="fzb-if15-001"]').click({ position: { x: 20, y: 30 } });
  await editor(page).getByTestId("node-name").fill("Is i a multiple of 15?");
  await expect(chart(page)).toContainText("Is i a multiple of 15?");
  await expect(chart(page)).not.toContainText("(remainder of i divided by 15) = 0?");
  await page.keyboard.press("Escape");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("python-code")).toContainText("    # Is i a multiple of 15?");
});

test("the editor opens on the node's right inside the canvas, the chart scrolled to make room (U-41)", async ({
  page,
}) => {
  await seedProgress(page, {});
  await seedProgram(page, "fizzbuzz", solutionOf("fizzbuzz"));
  await page.goto("/#/p/fizzbuzz");
  // The rightmost node: the centred chart leaves no room for the editor beside it.
  const node = page.locator('[data-chart-node="fzb-prfb-001"]');
  await node.click({ position: { x: 8, y: 8 } });
  await expect(editor(page)).toBeVisible();
  await expect
    .poll(async () => {
      const box = await node.boundingBox();
      const popup = await editor(page).boundingBox();
      const canvas = await page.getByTestId("canvas").boundingBox();
      if (!box || !popup || !canvas) return "not drawn";
      if (popup.x < box.x + box.width) return "not on the right";
      if (popup.x + popup.width > canvas.x + canvas.width) return "outside the canvas";
      return "ok";
    })
    .toBe("ok");
});

test("`,` in a list of values opens the next value after this one (U-93)", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await keys(page, "1,2");
  await expect(chart(page)).toContainText("Print 1, 2");
  await editor(page).locator("[data-value-line]").first().click();
  await keys(page, ",");
  await expect(chart(page)).toContainText("Print 1, choose a value, 2");
});

test("U-51: a print with no value draws no placeholder", async ({ page }) => {
  await seedProgress(page, {});
  await page.goto("/#/p/tutorial");
  await insert(page, "main/main/0", "print");
  await editor(page).getByRole("button", { name: "Remove this value" }).click();
  await expect(chart(page)).not.toContainText("choose a value");
});
