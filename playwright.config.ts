import { defineConfig, devices } from "@playwright/test";

// E2E tests run against a fresh production build (astro preview) on port 4322,
// so they don't collide with the dev server on 4321. Each test gets its own
// browser context => clean IndexedDB, deterministic numbering (INV-0001, ...).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4322",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Run against the dev server: it reliably renders the React island, registers
  // no service worker (gated to prod), and reproduces all UI/interaction bugs.
  webServer: {
    command: "npm run dev -- --port 4322",
    url: "http://localhost:4322",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
