import { expect, test } from "@playwright/test";

test.describe("Documentation Page", () => {
  test("should redirect docs to plugins page", async ({ page }) => {
    await page.goto("/docs");
    await expect(page).toHaveURL(/\/plugins/);
  });

  test("should have navigation to plugin categories", async ({ page }) => {
    await page.goto("/plugins");
    const links = page.locator('a[href^="/plugins/"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});
