import { defineConfig } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "./tests/layout",
  outputDir: ".cache/playwright-results",
  reporter: "line",
  use: {
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    baseURL: process.env.BLOG_TEST_URL ?? `http://127.0.0.1:${port}`,
  },
  workers: 1,
  webServer: process.env.BLOG_TEST_URL
    ? undefined
    : {
        command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
