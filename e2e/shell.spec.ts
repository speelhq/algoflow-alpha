// The desktop-only gate.
import { expect, test } from "./fixtures";

test.describe("shell", () => {
  test("a viewport under 1280 px shows app.desktopOnly and no shell", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("desktop-only")).toBeVisible();
    await expect(page.getByTestId("shell")).toHaveCount(0);
  });

  test("a desktop viewport shows the shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell")).toBeVisible();
    await expect(page.getByTestId("desktop-only")).toHaveCount(0);
  });
});
