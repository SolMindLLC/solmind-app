import { defineConfig } from "@playwright/test";

const rawPort = process.env.SOLMIND_WHOLE_PATH_APP_PORT ?? "4321";
const port = Number(rawPort);
const WHOLE_PATH_PROJECT_TIMEOUT_MS = 1_800_000;
if (!Number.isInteger(port) || port < 4_100 || port > 4_999) {
  throw new Error("whole_path_playwright_invalid_application_port");
}

export default defineConfig({
  testDir: "./tests/whole-path",
  testMatch: "suggestedWaypointWholePath.pw.ts",
  outputDir: "test-results/whole-path",
  fullyParallel: false,
  forbidOnly: true,
  maxFailures: 1,
  retries: 0,
  workers: 1,
  reporter: "line",
  timeout: WHOLE_PATH_PROJECT_TIMEOUT_MS,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1_280, height: 900 } },
    },
    {
      name: "narrow-chromium",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
  ],
});
