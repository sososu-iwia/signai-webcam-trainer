import { defineConfig } from "@playwright/test";
import { developmentOrigins } from "./shared/development";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    locale: "en-US",
    baseURL: developmentOrigins.frontend,
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  webServer: [
    {
      command: "npm run dev:api",
      url: `${developmentOrigins.backend}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "npm run dev:web",
      url: developmentOrigins.frontend,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
