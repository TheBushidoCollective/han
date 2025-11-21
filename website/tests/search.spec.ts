import { test, expect } from '@playwright/test';

test.describe('Search Page', () => {
  test('should load the search page', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('h1')).toContainText('Search Plugins');
  });

  test('should display search bar', async ({ page }) => {
    await page.goto('/search');
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test('should show quick links', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('link', { name: /browse by tags/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /all plugins/i })).toBeVisible();
  });

  test('should navigate to tags page from quick links', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('link', { name: /browse by tags/i }).click();
    await expect(page).toHaveURL(/\/tags/);
  });

  test('should display category counts', async ({ page }) => {
    await page.goto('/search');
    const bushidoLink = page.getByRole('link', { name: /bushido/i });
    await expect(bushidoLink).toBeVisible();
  });
});
