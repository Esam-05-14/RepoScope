import { defineConfig } from "@playwright/test";

const channel = process.env.PW_CHANNEL;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI === "true" ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:8787" },
  projects: [
    {
      name: "chromium",
      use: channel !== undefined && channel !== "" ? { channel } : { browserName: "chromium" },
    },
  ],
});
