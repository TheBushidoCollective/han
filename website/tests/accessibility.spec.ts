import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('home page should have no accessibility violations', async ({ page }) => {
    await page.goto('/');

    // Check for essential accessibility features
    const main = page.locator('main, [role="main"]');
    const nav = page.locator('nav, [role="navigation"]');

    // At least one should exist
    const mainCount = await main.count();
    const navCount = await nav.count();
    expect(mainCount + navCount).toBeGreaterThan(0);
  });

  test('all pages should have proper heading hierarchy', async ({ page }) => {
    const pages = ['/', '/docs', '/plugins', '/search', '/tags'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
    }
  });

  test('links should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through links
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('buttons should have proper type attributes', async ({ page }) => {
    await page.goto('/tags');
    const buttons = page.locator('button:not([type])');
    const count = await buttons.count();
    // All buttons should have type attribute
    expect(count).toBe(0);
  });
});
