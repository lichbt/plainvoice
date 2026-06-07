import { defineConfig } from "vitest/config";

// Vitest = unit tests only (pure logic). Restrict to src/*.test.ts so it never
// tries to run the Playwright e2e specs (which live in /e2e as *.spec.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
