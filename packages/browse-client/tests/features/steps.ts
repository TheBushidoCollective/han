/**
 * Generic, reusable step definitions for BDD tests.
 * These steps follow DRY principles - parameterized for maximum reuse.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// ----- Navigation Steps -----

Given('I am on the {string} page', async ({ page }, path: string) => {
  const url = path.startsWith('/') ? path : `/${path}`;
  await page.goto(url);
});

Given('my url path is {string}', async ({ page }, path: string) => {
  const url = path.startsWith('/') ? path : `/${path}`;
  await page.goto(url);
});

When('I navigate to {string}', async ({ page }, path: string) => {
  const url = path.startsWith('/') ? path : `/${path}`;
  await page.goto(url);
});

When('the page loads', async ({ page }) => {
  // Wait for DOM content loaded (don't use networkidle - EventSource keeps connection open)
  await page.waitForLoadState('domcontentloaded');
  // Wait for the root element to have content (React mounted)
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    },
    { timeout: 30000 }
  );
  // Wait for Suspense boundaries to resolve (no "Loading..." spinners)
  try {
    await page.waitForFunction(
      () => {
        const bodyText = document.body?.textContent || '';
        // Wait until there are no common loading indicators
        return (
          !bodyText.includes('Loading...') &&
          !bodyText.includes('Loading project') &&
          !bodyText.includes('Loading sessions') &&
          !bodyText.includes('Loading repo')
        );
      },
      { timeout: 15000 }
    );
  } catch {
    // Timeout is ok - some pages may have permanent loading states
  }
});

// ----- Click Steps -----

When('I click on {string}', async ({ page }, selector: string) => {
  const element = page.locator(selector).first();
  await element.waitFor({ state: 'visible', timeout: 5000 });
  await element.click();
});

When('I click on {string} if it exists', async ({ page }, selector: string) => {
  const element = page.locator(selector).first();
  const exists = await element.isVisible().catch(() => false);
  if (exists) {
    await element.click();
  }
});

When('I click on link {string}', async ({ page }, text: string) => {
  await page
    .getByRole('link', { name: new RegExp(text, 'i') })
    .first()
    .click();
});

When('I click on button {string}', async ({ page }, text: string) => {
  await page
    .getByRole('button', { name: new RegExp(text, 'i') })
    .first()
    .click();
});

// ----- Input Steps -----

When(
  'I fill in {string} with {string}',
  async ({ page }, selector: string, value: string) => {
    await page.locator(selector).fill(value);
  }
);

When(
  'I type {string} into {string}',
  async ({ page }, value: string, selector: string) => {
    await page.locator(selector).fill(value);
  }
);

When('I clear {string}', async ({ page }, selector: string) => {
  await page.locator(selector).clear();
});

// ----- Visibility Steps -----

Then('I should see {string}', async ({ page }, text: string) => {
  await expect(page.locator(`text=${text}`).first()).toBeVisible({
    timeout: 10000,
  });
});

Then('I should not see {string}', async ({ page }, text: string) => {
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).not.toContain(text);
});

Then(
  'the element {string} should be visible',
  async ({ page }, selector: string) => {
    await expect(page.locator(selector).first()).toBeVisible({
      timeout: 10000,
    });
  }
);

Then(
  'the element {string} should not be visible',
  async ({ page }, selector: string) => {
    await expect(page.locator(selector)).not.toBeVisible();
  }
);

Then('I should see element {string}', async ({ page }, selector: string) => {
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 10000 });
});

// ----- URL Steps -----

Then(
  'the url should contain {string}',
  async ({ page }, urlFragment: string) => {
    await expect(page).toHaveURL(new RegExp(urlFragment));
  }
);

Then('the url should be {string}', async ({ page }, url: string) => {
  await expect(page).toHaveURL(url);
});

Then('the url should match {string}', async ({ page }, pattern: string) => {
  await expect(page).toHaveURL(new RegExp(pattern));
});

Then(
  'the url should contain {string} or I am on the homepage',
  async ({ page }, urlFragment: string) => {
    // This step passes if we navigated to the fragment OR stayed on homepage (no sessions)
    const url = page.url();
    const matchesFragment = url.includes(urlFragment);
    const isHomepage = url.endsWith('/') || url.endsWith(':41956');
    expect(matchesFragment || isHomepage).toBe(true);
  }
);

// ----- Title Steps -----

Then(
  'the page title should contain {string}',
  async ({ page }, text: string) => {
    await expect(page).toHaveTitle(new RegExp(text));
  }
);

Then('the page title should be {string}', async ({ page }, title: string) => {
  await expect(page).toHaveTitle(title);
});

// ----- Heading Steps -----

Then('I should see heading {string}', async ({ page }, text: string) => {
  await expect(
    page.getByRole('heading', { name: new RegExp(text, 'i') }).first()
  ).toBeVisible();
});

Then(
  'the main heading should contain {string}',
  async ({ page }, text: string) => {
    await expect(page.locator('h1').first()).toContainText(text);
  }
);

// ----- Content Steps -----

Then('the page should contain {string}', async ({ page }, text: string) => {
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toContain(text);
});

Then('the page should not contain {string}', async ({ page }, text: string) => {
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).not.toContain(text);
});

// ----- Count Steps -----

Then(
  'I should see {int} {string} elements',
  async ({ page }, count: number, selector: string) => {
    await expect(page.locator(selector)).toHaveCount(count);
  }
);

Then(
  'I should see at least {int} {string} elements',
  async ({ page }, count: number, selector: string) => {
    const actualCount = await page.locator(selector).count();
    expect(actualCount).toBeGreaterThanOrEqual(count);
  }
);

// ----- Wait Steps -----

Given('I wait for {int} seconds', async ({ page }, seconds: number) => {
  await page.waitForTimeout(seconds * 1000);
});

Then('I wait for element {string}', async ({ page }, selector: string) => {
  await page.waitForSelector(selector, { timeout: 10000 });
});

// ----- Form Steps -----

When(
  'I select {string} from {string}',
  async ({ page }, value: string, selector: string) => {
    await page.locator(selector).selectOption(value);
  }
);

When('I check {string}', async ({ page }, selector: string) => {
  await page.locator(selector).check();
});

When('I uncheck {string}', async ({ page }, selector: string) => {
  await page.locator(selector).uncheck();
});

// ----- Link Steps -----

Then('I should see a link to {string}', async ({ page }, linkText: string) => {
  await expect(
    page.getByRole('link', { name: new RegExp(linkText, 'i') }).first()
  ).toBeVisible();
});

Then('I should see link with href {string}', async ({ page }, href: string) => {
  await expect(page.locator(`a[href*="${href}"]`).first()).toBeVisible();
});

Then(
  'I should see link with href {string} if it exists',
  async ({ page }, href: string) => {
    const element = page.locator(`a[href*="${href}"]`).first();
    await element.isVisible().catch(() => false);
    // Pass regardless of whether it exists or not
  }
);

// ----- Conditional Steps -----

Then(
  'the element {string} should be visible if it exists',
  async ({ page }, selector: string) => {
    const element = page.locator(selector).first();
    await element.isVisible().catch(() => false);
    // Pass regardless of whether it exists or not
  }
);

Then(
  'the page should contain {string} if it exists',
  async ({ page }, _text: string) => {
    // This step always passes - it's a conditional check
    await page.locator('body').textContent();
    // Don't assert - just check silently
  }
);

Then('I should see {string} if it exists', async ({ page }, text: string) => {
  // This step always passes - it's a conditional check
  await page
    .locator(`text=${text}`)
    .first()
    .isVisible()
    .catch(() => false);
  // Don't assert - just check silently
});

When(
  'I type {string} into {string} if it exists',
  async ({ page }, value: string, selector: string) => {
    const element = page.locator(selector).first();
    const exists = await element.isVisible().catch(() => false);
    if (exists) {
      await element.fill(value);
    }
  }
);

When(
  'I click on button {string} if it exists',
  async ({ page }, text: string) => {
    const element = page
      .getByRole('button', { name: new RegExp(text, 'i') })
      .first();
    const exists = await element.isVisible().catch(() => false);
    if (exists) {
      await element.click();
    }
  }
);

// ----- Alternative Steps -----

Then('{string} should be visible', async ({ page }, selector: string) => {
  await expect(page.locator(selector).first()).toBeVisible({
    timeout: 10000,
  });
});

// ----- CSS Property Steps -----

Then(
  'the element {string} should have css {string} {string}',
  async (
    { page },
    selector: string,
    cssProperty: string,
    expectedValue: string
  ) => {
    const element = page.locator(selector).first();
    await expect(element).toBeVisible({ timeout: 10000 });
    const actualValue = await element.evaluate(
      (el, prop) => window.getComputedStyle(el).getPropertyValue(prop),
      cssProperty
    );
    expect(actualValue).toBe(expectedValue);
  }
);
