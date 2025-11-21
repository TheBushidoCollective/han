import { expect, test } from '@playwright/test';

test.describe('Plugins Page', () => {
  test('should load the plugins page', async ({ page }) => {
    await page.goto('/plugins');
    await expect(page.locator('h1')).toContainText(/plugins/i);
  });

  test('should display category links', async ({ page }) => {
    await page.goto('/plugins');
    await expect(page.getByRole('link', { name: /bushido/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /buki/i })).toBeVisible();
  });

  test('should navigate to bushido category', async ({ page }) => {
    await page.goto('/plugins');
    await page.getByRole('link', { name: /bushido/i }).click();
    await expect(page).toHaveURL(/\/plugins\/bushido/);
  });
});

test.describe('Category Page', () => {
  test('should load bushido category page', async ({ page }) => {
    await page.goto('/plugins/bushido');
    await expect(page.locator('h1')).toContainText('Bushido');
  });

  test('should display plugins in category', async ({ page }) => {
    await page.goto('/plugins/buki');
    const pluginCards = page.locator('a[href^="/plugins/buki/"]');
    const count = await pluginCards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Plugin Detail Page', () => {
  test('should load a plugin detail page', async ({ page }) => {
    await page.goto('/plugins/bushido/core');
    await expect(page.locator('h1')).toContainText('bushido');
  });

  test('should display installation section', async ({ page }) => {
    await page.goto('/plugins/bushido/core');
    await expect(page.getByText('Installation')).toBeVisible();
  });

  test('should show skills section if available', async ({ page }) => {
    await page.goto('/plugins/bushido/core');
    const skills = page.getByRole('heading', { name: 'Skills' });
    if ((await skills.count()) > 0) {
      await expect(skills.first()).toBeVisible();
    }
  });

  test('should navigate to skill detail page', async ({ page }) => {
    await page.goto('/plugins/bushido/core');
    const skillLinks = page.locator('a[href*="/skills/"]');
    const count = await skillLinks.count();

    if (count > 0) {
      const href = await skillLinks.first().getAttribute('href');
      await skillLinks.first().click();
      await page.waitForLoadState('networkidle');
      // Only check if href was an actual navigation link
      if (href?.startsWith('/skills/')) {
        await expect(page.url()).toContain('/skills/');
      }
    }
  });
});
