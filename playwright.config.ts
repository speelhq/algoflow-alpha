import { defineConfig, devices } from "@playwright/test";

const base = process.env.VITE_BASE ?? "/";
const port = 4173;
const url = `http://localhost:${port}${base}`;
// Chromium alone at 1440 × 900: one browser keeps CI under a minute and matches the desktop-only
// scope, and the viewport exceeds the 1280 px gate with room for the default panel sizes. The
// screenshot suite draws at the artboards' 1280 × 800 instead.
const desktop = { width: 1440, height: 900 };

// `test:e2e` runs Playwright against `dist/` (build first).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // No retry: a test that passes on its second attempt has a fault to find, and a retry would
  // turn it green. The trace of the failing attempt is kept instead.
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: url,
    viewport: desktop,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: desktop } }],
  webServer: {
    command: `pnpm exec vite preview --port ${port} --strictPort`,
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
