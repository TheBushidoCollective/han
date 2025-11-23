---
name: cucumber-step-definitions
description: Writing effective step definitions and organizing test code
---

# Cucumber Step Definitions

Master writing maintainable and reusable step definitions for Cucumber tests.

## Basic Step Definitions

Define steps that match Gherkin syntax:

### JavaScript/TypeScript (Cucumber.js)

```javascript
const { Given, When, Then } = require('@cucumber/cucumber');

Given('I am on the login page', async function() {
  await this.page.goto('/login');
});

When('I enter valid credentials', async function() {
  await this.page.fill('#username', 'testuser');
  await this.page.fill('#password', 'password123');
});

Then('I should be logged in', async function() {
  const welcomeMessage = await this.page.textContent('.welcome');
  expect(welcomeMessage).toContain('Welcome, testuser');
});
```

### Java (Cucumber-JVM)

```java
import io.cucumber.java.en.*;
import static org.junit.Assert.*;

public class LoginSteps {

  @Given("I am on the login page")
  public void i_am_on_login_page() {
    driver.get("http://example.com/login");
  }

  @When("I enter valid credentials")
  public void i_enter_valid_credentials() {
    driver.findElement(By.id("username")).sendKeys("testuser");
    driver.findElement(By.id("password")).sendKeys("password123");
  }

  @Then("I should be logged in")
  public void i_should_be_logged_in() {
    String welcome = driver.findElement(By.className("welcome")).getText();
    assertTrue(welcome.contains("Welcome, testuser"));
  }
}
```

### Ruby

```ruby
Given('I am on the login page') do
  visit '/login'
end

When('I enter valid credentials') do
  fill_in 'username', with: 'testuser'
  fill_in 'password', with: 'password123'
end

Then('I should be logged in') do
  expect(page).to have_content('Welcome, testuser')
end
```

## Parameterized Steps

Capture values from Gherkin steps:

```javascript
// Scenario: I search for "Cucumber" in the search bar

When('I search for {string} in the search bar', async function(searchTerm) {
  await this.page.fill('#search', searchTerm);
  await this.page.click('#search-button');
});

// Scenario: I add 5 items to my cart

When('I add {int} items to my cart', async function(quantity) {
  for (let i = 0; i < quantity; i++) {
    await this.addItemToCart();
  }
});

// Scenario: The price should be $99.99

Then('the price should be ${float}', async function(expectedPrice) {
  const actualPrice = await this.page.textContent('.price');
  expect(parseFloat(actualPrice)).toBe(expectedPrice);
});
```

## Regular Expressions

Use regex for flexible matching:

```javascript
// Matches: "I wait 5 seconds", "I wait 10 seconds"
When(/^I wait (\d+) seconds?$/, async function(seconds) {
  await this.page.waitForTimeout(seconds * 1000);
});

// Matches: "I should see a success message", "I should see an error message"
Then(/^I should see (?:a|an) (success|error) message$/, async function(type) {
  const message = await this.page.textContent(`.${type}-message`);
  expect(message).toBeTruthy();
});
```

## Data Tables

Handle tabular data in steps:

```javascript
When('I create a user with the following details:', async function(dataTable) {
  // dataTable.hashes() converts to array of objects
  const users = dataTable.hashes();

  for (const user of users) {
    await this.api.createUser({
      firstName: user['First Name'],
      lastName: user['Last Name'],
      email: user['Email']
    });
  }
});

// Alternative: dataTable.raw() for raw 2D array
When('I select the following options:', async function(dataTable) {
  const options = dataTable.raw().flat(); // ['Option1', 'Option2']

  for (const option of options) {
    await this.page.check(`input[value="${option}"]`);
  }
});
```

## Doc Strings

Handle multi-line text:

```javascript
When('I submit a message:', async function(messageText) {
  await this.page.fill('#message', messageText);
  await this.page.click('#submit');
});
```

## World Context

Share state between steps using World:

```javascript
const { setWorldConstructor, World } = require('@cucumber/cucumber');

class CustomWorld extends World {
  constructor(options) {
    super(options);
    this.cart = [];
    this.user = null;
  }

  async login(username, password) {
    this.user = await this.api.login(username, password);
  }

  addToCart(item) {
    this.cart.push(item);
  }
}

setWorldConstructor(CustomWorld);

// Use in steps
Given('I am logged in', async function() {
  await this.login('testuser', 'password');
});

When('I add an item to my cart', async function() {
  this.addToCart({ id: 1, name: 'Product' });
});
```

## Hooks

Set up and tear down test state:

```javascript
const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');

BeforeAll(async function() {
  // Runs once before all scenarios
  await startTestServer();
});

Before(async function() {
  // Runs before each scenario
  this.browser = await launchBrowser();
  this.page = await this.browser.newPage();
});

Before({ tags: '@database' }, async function() {
  // Runs only for scenarios with @database tag
  await this.db.clear();
});

After(async function() {
  // Runs after each scenario
  await this.browser.close();
});

AfterAll(async function() {
  // Runs once after all scenarios
  await stopTestServer();
});
```

## Step Organization

### Page Object Pattern

```javascript
// pages/LoginPage.js
class LoginPage {
  constructor(page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto('/login');
  }

  async fillCredentials(username, password) {
    await this.page.fill('#username', username);
    await this.page.fill('#password', password);
  }

  async submit() {
    await this.page.click('#login-button');
  }
}

// step-definitions/login-steps.js
const LoginPage = require('../pages/LoginPage');

Given('I am on the login page', async function() {
  this.loginPage = new LoginPage(this.page);
  await this.loginPage.navigate();
});

When('I enter {string} and {string}', async function(username, password) {
  await this.loginPage.fillCredentials(username, password);
  await this.loginPage.submit();
});
```

### Helper Functions

```javascript
// support/helpers.js
async function waitForElement(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
}

async function takeScreenshot(page, name) {
  await page.screenshot({ path: `screenshots/${name}.png` });
}

module.exports = { waitForElement, takeScreenshot };

// Use in steps
const { waitForElement } = require('../support/helpers');

Then('I should see the dashboard', async function() {
  await waitForElement(this.page, '.dashboard');
});
```

## Best Practices

1. **Keep steps simple and focused** - One action or assertion per step
2. **Reuse steps** - Write generic steps that work for multiple scenarios
3. **Avoid implementation details** - Don't expose internal structure in step names
4. **Use the World** - Share state through World, not global variables
5. **Organize by domain** - Group related steps together
6. **Don't duplicate logic** - Extract common functionality to helpers
7. **Make steps readable** - Step definitions should read like documentation
8. **Handle async properly** - Use async/await consistently

## Anti-Patterns to Avoid

❌ **Don't create overly specific steps:**

```javascript
Given('I am on the login page as a premium user with valid credentials')
```

✅ **Create composable steps:**

```javascript
Given('I am on the login page')
And('I am a premium user')
And('I have valid credentials')
```

❌ **Don't put assertions in Given/When:**

```javascript
When('I click login and see the dashboard')
```

✅ **Separate actions and assertions:**

```javascript
When('I click login')
Then('I should see the dashboard')
```

❌ **Don't use steps as functions:**

```javascript
// Don't call steps from within steps
When('I log in', async function() {
  await this.Given('I am on the login page'); // Bad!
  await this.When('I enter credentials'); // Bad!
});
```

✅ **Extract to helper functions:**

```javascript
// support/auth-helpers.js
async function login(world, username, password) {
  await world.page.goto('/login');
  await world.page.fill('#username', username);
  await world.page.fill('#password', password);
  await world.page.click('#login-button');
}

// Use in steps
When('I log in', async function() {
  await login(this, 'user', 'pass');
});
```

Remember: Step definitions are the glue between readable scenarios and automation code. Keep them clean, maintainable, and focused.
