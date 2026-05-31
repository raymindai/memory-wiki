import { test, expect } from "@playwright/test";

test("snapshot localhost root for brand verification", async ({ page }) => {
  await page.goto("http://localhost:3000/?e2e=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const screenshotPath = "/Users/hyunsangcho/Desktop/Projects/mdcore/apps/web/screenshots/web-neutral-accent.png";
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log("saved:", screenshotPath);
});
