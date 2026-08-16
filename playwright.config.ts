import { defineConfig } from "@playwright/test";

const browserTestPort = Number(
  process.env.SOLMIND_BROWSER_TEST_PORT ?? "4173",
);

if (!Number.isInteger(browserTestPort) || browserTestPort < 1024 || browserTestPort > 65535) {
  throw new Error("SOLMIND_BROWSER_TEST_PORT must be an integer from 1024 through 65535.");
}

const baseURL = `http://127.0.0.1:${browserTestPort}`;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.pw.ts",
  outputDir: "test-results/browser",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "narrow-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
