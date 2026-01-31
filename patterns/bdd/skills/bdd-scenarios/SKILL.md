---
name: bdd-scenarios
description: Use when writing effective BDD scenarios including acceptance criteria, edge cases, and scenario organization. Use when defining behavior specifications.
allowed-tools:
  - Bash
  - Read
---

# BDD Scenarios

Learn to write clear, maintainable BDD scenarios that effectively capture business requirements and drive implementation.

## Writing Good Scenarios

A good scenario should be:

- **Specific**: Test one behavior
- **Declarative**: Describe what, not how
- **Business-focused**: Use domain language
- **Independent**: No dependencies on other scenarios

```gherkin
# Good scenario - specific and declarative
Scenario: Customer receives loyalty discount
  Given a customer with Gold membership status
  And a cart total of $100
  When the customer proceeds to checkout
  Then a 10% loyalty discount should be applied
  And the final total should be $90

# Bad scenario - too implementation-focused
Scenario: Apply discount
  Given I click the membership dropdown
  And I select "Gold" from the list
  When I click the checkout button
  Then the JavaScript calculates 10% off
```

## Acceptance Criteria Format

```gherkin
Feature: Order Refunds

  # Rule-based acceptance criteria
  Rule: Full refunds are available within 30 days

    Scenario: Refund requested within return window
      Given an order placed 15 days ago
      When the customer requests a refund
      Then a full refund should be processed

    Scenario: Refund requested after return window
      Given an order placed 45 days ago
      When the customer requests a refund
      Then the refund should be denied
      And the customer should see "Return window expired"
```

## Edge Case Scenarios

```gherkin
Feature: User Registration

  Scenario: Successful registration
    Given I am on the registration page
    When I submit valid registration details
    Then my account should be created

  # Edge cases
  Scenario: Registration with existing email
    Given a user exists with email "existing@example.com"
    When I try to register with email "existing@example.com"
    Then I should see "Email already registered"

  Scenario: Registration with invalid email format
    When I try to register with email "not-an-email"
    Then I should see "Please enter a valid email"

  Scenario: Registration with empty required fields
    When I submit the registration form with empty fields
    Then I should see validation errors for required fields
```

## Scenario Tags and Organization

```gherkin
@authentication @critical
Feature: User Login

  @smoke
  Scenario: Basic login flow
    # ...

  @security
  Scenario: Account lockout after failed attempts
    # ...

  @wip
  Scenario: Two-factor authentication
    # Work in progress
```

## When to Use This Skill

Use bdd-scenarios when you need to:

- Define acceptance criteria for user stories
- Document expected system behavior
- Create comprehensive test coverage
- Identify edge cases early in development
- Communicate requirements clearly

## Best Practices

- Start with the happy path scenario
- Add edge cases systematically
- Use tags for organization and filtering
- Keep scenarios at 3-7 steps
- Write scenarios before implementation
- Review scenarios with stakeholders

## Common Pitfalls

- Writing scenarios after implementation
- Including too many steps per scenario
- Using vague or ambiguous language
- Forgetting negative test cases
- Not organizing with tags effectively
