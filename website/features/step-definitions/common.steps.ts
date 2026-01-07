/**
 * Generic, reusable step definitions for BDD tests.
 * These steps follow DRY principles - parameterized for maximum reuse.
 */
import { expect } from "@playwright/test";
import { Given, Then, When } from "./fixtures";

// ----- Navigation Steps -----

Given("I am on the {string} page", async ({ page }, path: string) => {
	const url = path.startsWith("/") ? path : `/${path}`;
	await page.goto(url);
});

Given("my url path is {string}", async ({ page }, path: string) => {
	const url = path.startsWith("/") ? path : `/${path}`;
	await page.goto(url);
});

When("I navigate to {string}", async ({ page }, path: string) => {
	const url = path.startsWith("/") ? path : `/${path}`;
	await page.goto(url);
});

When("the page loads", async ({ page }) => {
	await page.waitForLoadState("networkidle");
});

// ----- Click Steps -----

When("I click on {string}", async ({ page }, selector: string) => {
	const element = page.locator(selector).first();
	await element.waitFor({ state: "visible", timeout: 5000 });
	await element.click();
});

When("I click on {string} if it exists", async ({ page }, selector: string) => {
	const element = page.locator(selector).first();
	const exists = await element.isVisible().catch(() => false);
	if (exists) {
		await element.click();
	}
});

When("I click on link {string}", async ({ page }, text: string) => {
	await page
		.getByRole("link", { name: new RegExp(text, "i") })
		.first()
		.click();
});

When("I click on button {string}", async ({ page }, text: string) => {
	await page
		.getByRole("button", { name: new RegExp(text, "i") })
		.first()
		.click();
});

// ----- Input Steps -----

When(
	"I fill in {string} with {string}",
	async ({ page }, selector: string, value: string) => {
		await page.locator(selector).fill(value);
	},
);

When(
	"I type {string} into {string}",
	async ({ page }, value: string, selector: string) => {
		await page.locator(selector).fill(value);
	},
);

// ----- Visibility Steps -----

Then("I should see {string}", async ({ page }, text: string) => {
	await expect(page.locator(`text=${text}`).first()).toBeVisible({
		timeout: 10000,
	});
});

Then("I should not see {string}", async ({ page }, text: string) => {
	const bodyText = await page.locator("body").textContent();
	expect(bodyText).not.toContain(text);
});

Then(
	"the element {string} should be visible",
	async ({ page }, selector: string) => {
		await expect(page.locator(selector).first()).toBeVisible({
			timeout: 10000,
		});
	},
);

Then(
	"the element {string} should not be visible",
	async ({ page }, selector: string) => {
		await expect(page.locator(selector)).not.toBeVisible();
	},
);

// ----- URL Steps -----

Then(
	"the url should contain {string}",
	async ({ page }, urlFragment: string) => {
		await expect(page).toHaveURL(new RegExp(urlFragment));
	},
);

Then("the url should be {string}", async ({ page }, url: string) => {
	await expect(page).toHaveURL(url);
});

Then("the url should match {string}", async ({ page }, pattern: string) => {
	await expect(page).toHaveURL(new RegExp(pattern));
});

// ----- Title Steps -----

Then(
	"the page title should contain {string}",
	async ({ page }, text: string) => {
		await expect(page).toHaveTitle(new RegExp(text));
	},
);

Then("the page title should be {string}", async ({ page }, title: string) => {
	await expect(page).toHaveTitle(title);
});

// ----- Heading Steps -----

Then("I should see heading {string}", async ({ page }, text: string) => {
	await expect(
		page.getByRole("heading", { name: new RegExp(text, "i") }).first(),
	).toBeVisible();
});

Then(
	"the main heading should contain {string}",
	async ({ page }, text: string) => {
		await expect(page.locator("h1").first()).toContainText(text);
	},
);

Then(
	"I should see heading {string} if it exists",
	async ({ page }, text: string) => {
		const heading = page.getByRole("heading", { name: new RegExp(text, "i") });
		const count = await heading.count();
		if (count > 0) {
			await expect(heading.first()).toBeVisible();
		}
	},
);

// ----- Content Steps -----

Then("the page should contain {string}", async ({ page }, text: string) => {
	const bodyText = await page.locator("body").textContent();
	expect(bodyText).toContain(text);
});

Then("the page should not contain {string}", async ({ page }, text: string) => {
	const bodyText = await page.locator("body").textContent();
	expect(bodyText).not.toContain(text);
});

// ----- Count Steps -----

Then(
	"I should see {int} {string} elements",
	async ({ page }, count: number, selector: string) => {
		await expect(page.locator(selector)).toHaveCount(count);
	},
);

Then(
	"I should see at least {int} {string} elements",
	async ({ page }, count: number, selector: string) => {
		const actualCount = await page.locator(selector).count();
		expect(actualCount).toBeGreaterThanOrEqual(count);
	},
);

// ----- Wait Steps -----

Given("I wait for {int} seconds", async ({ page }, seconds: number) => {
	await page.waitForTimeout(seconds * 1000);
});

Then("I wait for element {string}", async ({ page }, selector: string) => {
	await page.waitForSelector(selector, { timeout: 10000 });
});

// ----- Link Steps -----

Then("I should see a link to {string}", async ({ page }, linkText: string) => {
	await expect(
		page.getByRole("link", { name: new RegExp(linkText, "i") }).first(),
	).toBeVisible();
});

Then("I should see link with href {string}", async ({ page }, href: string) => {
	await expect(page.locator(`a[href*="${href}"]`).first()).toBeVisible();
});
