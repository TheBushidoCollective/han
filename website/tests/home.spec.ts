import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Han/);
  });

  test('should display the main heading', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('h1');
    await expect(heading).toContainText('Han');
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');
    const docsLink = page.getByRole('link', { name: /docs/i });
    const pluginsLink = page.getByRole('link', { name: /plugins/i });
    await expect(docsLink).toBeVisible();
    await expect(pluginsLink).toBeVisible();
  });

  test('should navigate to docs page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /docs/i }).click();
    await expect(page).toHaveURL(/\/docs/);
  });

  test('should navigate to plugins page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /plugins/i }).click();
    await expect(page).toHaveURL(/\/plugins/);
  });
});
