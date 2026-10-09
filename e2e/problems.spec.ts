// U-01, U-02, U-04, U-06, U-07, U-10, U-12, U-13, U-14, U-90: routes, the Problems page, Help,
// first launch.
import { expect, test } from "@playwright/test";
import { seedProgress } from "./seed";

/** Stores `entries` under `algoflow:progress` (C-17) before the app loads. */

test.describe("first launch (U-90)", () => {
  test("with nothing stored, the first problem of the first plan opens", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("problem-page")).toBeVisible();
    await expect(page).toHaveTitle("Hello — AlgoFlow");
    await expect(page).toHaveURL(/#\/p\/tutorial$/);
  });

  test("← Problems then stays on the Problems page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "← Problems" }).click();
    await expect(page.getByTestId("problems")).toBeVisible();
    await expect(page).toHaveTitle("Problems — AlgoFlow");
  });

  test("the layout key alone still counts as a first launch", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("algoflow:layout", "{}"));
    await page.goto("/");
    await expect(page).toHaveURL(/#\/p\/tutorial$/);
  });
});

test.describe("Problems page (U-10, U-12, U-13, U-14)", () => {
  test("shows the plan with its count, Continue, marks, difficulty, and topics", async ({
    page,
  }) => {
    await seedProgress(page, {
      tutorial: { status: "solved", hints: 0, solution: false },
      "sum-to-n": { status: "solved", hints: 1, solution: false },
      fizzbuzz: { status: "attempted", hints: 0, solution: false },
    });
    await page.goto("/#/");
    const plan = page.getByTestId("plan-course");
    await expect(plan.getByRole("heading", { name: "3-Day Course" })).toBeVisible();
    await expect(plan).toContainText("2 of 5 solved");
    await expect(
      plan.getByRole("link", { name: "Continue: FizzBuzz ▶", exact: true }),
    ).toHaveAttribute("href", "#/p/fizzbuzz");
    await expect(page.getByTestId("problem-tutorial").getByRole("img")).toHaveAccessibleName(
      "Solved",
    );
    await expect(page.getByTestId("problem-fizzbuzz").getByRole("img")).toHaveAccessibleName(
      "Attempted",
    );
    await expect(page.getByTestId("problem-countdown").getByRole("img")).toHaveAccessibleName(
      "Not started",
    );
    const fizzbuzz = page.getByTestId("problem-fizzbuzz");
    await expect(fizzbuzz).toContainText("FizzBuzz");
    await expect(fizzbuzz).toContainText("Easy");
    await expect(fizzbuzz).toContainText("Loops");
    await expect(fizzbuzz).toContainText("Conditions");
    await expect(page.getByTestId("plan-more")).toHaveCount(0);
  });

  test("Start appears while no problem of the plan has an entry", async ({ page }) => {
    await seedProgress(page, { nope: { status: "attempted", hints: 0, solution: false } });
    await page.goto("/#/");
    await expect(
      page.getByTestId("plan-course").getByRole("link", { name: "Start", exact: true }),
    ).toHaveAttribute("href", "#/p/tutorial");
  });

  test("a row opens its Problem page", async ({ page }) => {
    await seedProgress(page, {});
    await page.goto("/#/");
    await page.getByTestId("problem-fizzbuzz").click();
    await expect(page).toHaveURL(/#\/p\/fizzbuzz$/);
    await expect(page).toHaveTitle("FizzBuzz — AlgoFlow");
    await expect(page.getByTestId("top-bar")).toContainText("FizzBuzz");
  });
});

test.describe("header, Help, and routes (U-01, U-02, U-04, U-06, U-07)", () => {
  test.beforeEach(async ({ page }) => {
    await seedProgress(page, {});
  });

  test("Help opens the loop and the keyboard table, and closes", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("button", { name: "Help" }).click();
    const help = page.getByTestId("help");
    await expect(help).toBeVisible();
    await expect(help).toContainText("Build: add blocks");
    await expect(help.getByRole("row", { name: /Ctrl\/Cmd\+Enter/ })).toContainText("Run / Pause");
    // The editor's keys are in the table too.
    await expect(help.getByRole("row", { name: /Tab, Shift\+Tab/ })).toContainText("slot");
    await expect(help.getByRole("row", { name: /↑, ↓/ })).toContainText("highlight");
    await help.getByRole("button", { name: "Close" }).click();
    await expect(help).toHaveCount(0);
  });

  test("the header tabs lead to the Playground and the Modules stub", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("link", { name: "Playground" }).click();
    await expect(page.getByTestId("playground")).toBeVisible();
    await expect(page).toHaveTitle("Playground — AlgoFlow");
    await page.getByRole("link", { name: "Modules" }).click();
    await expect(page.getByTestId("modules")).toBeVisible();
    await expect(page).toHaveTitle("Modules — AlgoFlow");
    await page.goto("/#/m/heap");
    await expect(page.getByTestId("modules")).toBeVisible();
    // U-07: a Playground program the Playground does not list.
    await page.goto("/#/play/abc");
    await expect(page.getByTestId("problems")).toBeVisible();
  });

  test("an unknown route or problem id shows the Problems page", async ({ page }) => {
    for (const hash of ["#/nope", "#/p/nope"]) {
      await page.goto(`/${hash}`);
      await expect(page.getByTestId("problems")).toBeVisible();
    }
  });
});
