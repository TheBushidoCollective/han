import { test, expect } from '@playwright/test';

test.describe('Documentation Page', () => {
  test('should load the docs page', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.locator('h1')).toContainText(/documentation/i);
  });

  test('should have navigation to plugin categories', async ({ page }) => {
    await page.goto('/docs');
    const links = page.locator('a[href^="/plugins/"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});
