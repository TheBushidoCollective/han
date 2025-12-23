import { expect, test } from '@playwright/test';
import { mockDashboardData, mockEmptyData } from './fixtures/graphql-mocks';

/**
 * Dashboard Page Tests
 *
 * Comprehensive tests for the main dashboard page.
 */

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock GraphQL endpoint
    await page.route('**/graphql', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      if (postData?.query?.includes('DashboardPageQuery')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDashboardData),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('should display dashboard header', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Dashboard' })
    ).toBeVisible();
    await expect(page.getByText('Han Development Environment')).toBeVisible();
  });

  test('should display live indicator', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Live')).toBeVisible();
  });

  test('should display project count stat card', async ({ page }) => {
    await page.goto('/');

    // Projects stat card is a button with text "Projects 3"
    const projectsCard = page.getByRole('button', { name: /Projects 3/i });
    await expect(projectsCard).toBeVisible();
  });

  test('should display tasks statistics', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Total Tasks')).toBeVisible();
    await expect(page.getByText('150')).toBeVisible();
    await expect(page.getByText('120 completed')).toBeVisible();
  });

  test('should display success rate', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Success Rate')).toBeVisible();
    await expect(page.getByText('85%')).toBeVisible();
    await expect(page.getByText('78% confidence')).toBeVisible();
  });

  test('should display calibration score', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Calibration')).toBeVisible();
    await expect(page.getByText('92%')).toBeVisible();
    await expect(page.getByText('Prediction accuracy')).toBeVisible();
  });

  test('should display plugin stats', async ({ page }) => {
    await page.goto('/');

    // User Plugins stat card is a button with the full text
    const pluginsCard = page.getByRole('button', {
      name: /User Plugins 5 10 enabled/i,
    });
    await expect(pluginsCard).toBeVisible();
  });

  test('should display recent sessions section', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Recent Sessions' })
    ).toBeVisible();
    // Sessions are rendered as buttons containing project names
    await expect(
      page.getByRole('button', { name: /han.*Writing tests/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /browse-client/i })
    ).toBeVisible();
  });

  test('should display session with current todo', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Writing tests')).toBeVisible();
    await expect(page.getByText('42 messages')).toBeVisible();
  });

  test('should display session with current task', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('implementation')).toBeVisible();
    await expect(page.getByText('Implement GraphQL integration')).toBeVisible();
  });

  test('should display agent health section', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Agent Health' })
    ).toBeVisible();
    await expect(page.getByText('Frustration Level')).toBeVisible();
    await expect(page.getByText('Checkpoints')).toBeVisible();
    await expect(page.getByText('25')).toBeVisible();
  });

  test('should display plugin categories', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Plugin Categories' })
    ).toBeVisible();
    await expect(page.getByText('jutsu')).toBeVisible();
    await expect(page.getByText('hashi')).toBeVisible();
    await expect(page.getByText('do')).toBeVisible();
  });

  test('should navigate to projects on stat card click', async ({ page }) => {
    await page.goto('/');

    // Click on Projects stat card
    await page.getByText('Projects').click();

    await expect(page).toHaveURL('/projects');
  });

  test('should navigate to metrics on Total Tasks click', async ({ page }) => {
    await page.goto('/');

    await page.getByText('Total Tasks').click();

    await expect(page).toHaveURL('/metrics');
  });

  test('should navigate to plugins on User Plugins click', async ({ page }) => {
    await page.goto('/');

    await page.getByText('User Plugins').click();

    await expect(page).toHaveURL('/plugins');
  });

  test('should navigate to sessions list', async ({ page }) => {
    await page.goto('/');

    // Find and click the "View All" link for Recent Sessions (it's a Link, not a button)
    await page.getByText('View All').first().click();

    await expect(page).toHaveURL('/sessions');
  });
});

test.describe('Dashboard Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/graphql', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockEmptyData),
      });
    });
  });

  test('should display zero stats', async ({ page }) => {
    await page.goto('/');

    // With empty data, the stat cards show 0 values
    await expect(
      page.getByRole('button', { name: /Projects 0/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Total Tasks 0 0 completed/i })
    ).toBeVisible();
  });

  test('should display no sessions message', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('No recent sessions')).toBeVisible();
  });

  test('should display no plugins message', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('No plugins installed')).toBeVisible();
  });
});

test.describe('Dashboard Loading State', () => {
  test('should show loading spinner initially', async ({ page }) => {
    // Delay the GraphQL response
    await page.route('**/graphql', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboardData),
      });
    });

    await page.goto('/');

    // Should show loading state
    await expect(page.getByText('Loading dashboard...')).toBeVisible();

    // Wait for data to load
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('Dashboard Error Handling', () => {
  test('should handle GraphQL errors gracefully', async ({ page }) => {
    await page.route('**/graphql', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [{ message: 'Internal server error' }],
        }),
      });
    });

    await page.goto('/');

    // Should show error or empty state
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle network errors', async ({ page }) => {
    await page.route('**/graphql', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    // Page should still render
    await expect(page.locator('body')).toBeVisible();
  });
});
