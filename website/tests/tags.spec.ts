import { expect, test } from '@playwright/test';

test.describe('Tags Page', () => {
  test('should load the tags page', async ({ page }) => {
    await page.goto('/tags');
    await expect(page.locator('h1')).toContainText('Browse by Tags');
  });

  test('should display tags overview', async ({ page }) => {
    await page.goto('/tags');
    const overview = page.locator('text=/Explore .* tags across .* plugins/');
    await expect(overview).toBeVisible();
  });

  test('should have search filter input', async ({ page }) => {
    await page.goto('/tags');
    const filterInput = page.getByPlaceholder(/filter tags/i);
    await expect(filterInput).toBeVisible();
  });

  test('should filter tags by search query', async ({ page }) => {
    await page.goto('/tags');
    const filterInput = page.getByPlaceholder(/filter tags/i);
    await filterInput.fill('typescript');

    // Wait for filtering to occur
    await page.waitForTimeout(300);

    // Should show TypeScript related tags
    const allTags = page
      .locator('button[type="button"]')
      .filter({ hasText: /.+/ });
    const count = await allTags.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display popular categories', async ({ page }) => {
    await page.goto('/tags');
    await expect(page.getByText('Popular Categories')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'language' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'framework' })).toBeVisible();
  });
});
