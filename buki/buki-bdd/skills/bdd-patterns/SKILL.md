---
name: bdd-patterns
description: Use when applying Behavior-Driven Development patterns including Given-When-Then structure, feature files, and acceptance criteria. Use when writing BDD-style tests and specifications.
allowed-tools:
  - Bash
  - Read
---

# BDD Patterns

Master Behavior-Driven Development patterns to write clear, business-readable specifications that drive implementation.

## Given-When-Then Structure

The fundamental BDD pattern uses three parts:

- **Given**: The initial context or preconditions
- **When**: The action or event being tested
- **Then**: The expected outcome or result

```gherkin
Feature: User Authentication

  Scenario: Successful login with valid credentials
    Given a registered user with email "user@example.com"
    And the user has password "secure123"
    When the user submits the login form with correct credentials
    Then the user should be redirected to the dashboard
    And a session should be created
```

## Feature File Organization

```gherkin
Feature: Shopping Cart
  As a customer
  I want to manage items in my cart
  So that I can purchase products I'm interested in

  Background:
    Given I am logged in as a customer
    And the product catalog is available

  Scenario: Add item to empty cart
    Given my cart is empty
    When I add "Blue T-Shirt" to my cart
    Then my cart should contain 1 item
    And the cart total should be $29.99

  Scenario: Remove item from cart
    Given my cart contains "Blue T-Shirt"
    When I remove "Blue T-Shirt" from my cart
    Then my cart should be empty
```

## Scenario Outlines for Data-Driven Tests

```gherkin
Scenario Outline: Password validation
  Given I am on the registration page
  When I enter password "<password>"
  Then I should see "<message>"

  Examples:
    | password    | message                        |
    | abc         | Password too short             |
    | abcdefgh    | Password needs a number        |
    | abcdefgh1   | Password accepted              |
    | abcdefgh1!  | Password accepted              |
```

## Step Definition Patterns

```ruby
# Ruby/Cucumber example
Given('a registered user with email {string}') do |email|
  @user = User.create!(email: email, password: 'password123')
end

When('the user submits the login form with correct credentials') do
  visit login_path
  fill_in 'Email', with: @user.email
  fill_in 'Password', with: 'password123'
  click_button 'Log In'
end

Then('the user should be redirected to the dashboard') do
  expect(page).to have_current_path(dashboard_path)
end
```

## When to Use This Skill

Use bdd-patterns when you need to:

- Write acceptance tests that stakeholders can understand
- Define behavior before implementation
- Create living documentation from tests
- Bridge communication between developers and business
- Ensure features meet business requirements

## Best Practices

- Write scenarios from the user's perspective
- Keep scenarios focused on single behaviors
- Use declarative language, not implementation details
- Reuse step definitions across scenarios
- Use Background for common setup steps
- Keep feature files organized by domain area

## Common Pitfalls

- Writing scenarios that are too technical
- Coupling steps to specific UI implementations
- Creating overly complex scenario outlines
- Not maintaining feature files as code changes
- Mixing multiple behaviors in one scenario
