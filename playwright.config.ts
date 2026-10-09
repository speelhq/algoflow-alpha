import { defineConfig, devices } from "@playwright/test";

const base = process.env.VITE_BASE ?? "/";
const port = 4173;
const url = `http://localhost:${port}${base}`;
// Chromium alone at 1440 × 900: one browser keeps CI under a minute and matches the desktop-only
// scope, and the viewport exceeds the 1280 px gate with room for the default panel sizes.
const desktop = { width: 1440, height: 900 };

// `test:e2e` runs Playwright against `dist/` (build first).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: url,
    viewport: desktop,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: desktop } }],
  webServer: {
    command: `pnpm exec vite preview --port ${port} --strictPort`,
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
