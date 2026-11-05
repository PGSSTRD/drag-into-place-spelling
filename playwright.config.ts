import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  maxFailures: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  outputDir: "test-results/browser",
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/browser-results.json" }],
  ],
  use: {
    browserName: "chromium",
    viewport: { width: 768, height: 1024 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "http", metadata: { transport: "http" }, testIgnore: "**/offline.spec.ts" },
    {
      name: "file",
      metadata: { transport: "file" },
      use: { launchOptions: { args: ["--allow-file-access-from-files"] } },
    },
  ],
});
