// S-02: the desktop-only gate.
import { expect, test } from "./fixtures";

test.describe("shell", () => {
  test("S-02: a viewport under 1280 px shows app.desktopOnly and no shell", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("desktop-only")).toBeVisible();
    await expect(page.getByTestId("shell")).toHaveCount(0);
  });

  test("S-02: a desktop viewport shows the shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell")).toBeVisible();
    await expect(page.getByTestId("desktop-only")).toHaveCount(0);
  });
});
