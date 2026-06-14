// Throwaway local config: pins memory.wiki's own dev server to a
// dedicated port so we never accidentally test against another
// project squatting on :3000. Not committed to CI.
import { defineConfig } from "@playwright/test";

const PORT = 3007;

export default defineConfig({
  testDir: "./e2e",
  timeout: 70000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: "only-on-failure",
    contextOptions: { storageState: undefined },
  },
  webServer: {
    command: `PORT=${PORT} npm run dev`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 90000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
