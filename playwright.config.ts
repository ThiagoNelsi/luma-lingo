import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm exec tsx e2e/support/test-api.ts",
      port: 3100,
      reuseExistingServer: false,
    },
    {
      command:
        "CHOKIDAR_USEPOLLING=true VITE_API_ORIGIN=http://127.0.0.1:3100 pnpm --filter @luma-lingo/web dev --host 127.0.0.1 --port 4173",
      port: 4173,
      reuseExistingServer: false,
    },
  ],
});
