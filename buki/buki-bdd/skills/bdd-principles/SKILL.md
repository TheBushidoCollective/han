---
name: bdd-principles
description: Core BDD concepts, philosophy, and the Three Amigos practice
---

# BDD Principles

Master the foundational principles and philosophy of Behavior-Driven Development.

## What is BDD?

Behavior-Driven Development (BDD) is a collaborative software development approach that:

- Bridges the gap between business and technical teams
- Uses concrete examples to describe system behavior
- Creates living documentation that serves as tests
- Focuses on delivering business value
- Promotes shared understanding through conversation

## Core Philosophy

### Discovery > Development > Delivery

**Discovery**: Collaborate to understand requirements

- Hold Three Amigos sessions
- Explore with examples
- Challenge assumptions
- Build shared understanding

**Development**: Implement guided by examples

- Use examples as specifications
- Automate examples as tests
- Follow outside-in TDD

**Delivery**: Validate against real behavior

- Executable specifications provide confidence
- Living documentation stays current
- Regressions are caught early

## The Three Amigos

A practice where three perspectives collaborate to explore and define features:

### 1. Business Perspective (Product Owner/BA)

- What problem are we solving?
- What value does it provide?
- What are the business rules?

### 2. Development Perspective (Developer)

- How might we build this?
- What are the technical constraints?
- What are the edge cases?

### 3. Testing Perspective (Tester/QA)

- What could go wrong?
- What are we missing?
- How will we verify this works?

### Example Three Amigos Session

**Feature**: Password Reset

**Business**: "Users who forget their password need a way to reset it via email."

**Developer**: "We'll need to generate secure tokens with expiration. How long should tokens be valid?"

**Tester**: "What happens if they request multiple reset emails? Can old tokens still be used?"

**Business**: "Tokens should be valid for 1 hour. Multiple requests should invalidate old tokens."

**Developer**: "Should we rate-limit reset requests to prevent abuse?"

**Tester**: "What if the email address doesn't exist in our system?"

**Business**: "For security, show the same success message whether or not the email exists."

**Outcome**: Concrete examples that become scenarios:

```gherkin
Scenario: Request password reset with valid email
  Given a user account exists for "user@example.com"
  When I request a password reset for "user@example.com"
  Then I should receive a reset email
  And the reset link should be valid for 1 hour

Scenario: Request password reset with non-existent email
  When I request a password reset for "nonexistent@example.com"
  Then I should see a success message
  But no email should be sent

Scenario: Multiple password reset requests
  Given I have requested a password reset
  When I request another password reset
  Then the previous reset link should be invalidated
  And I should receive a new reset email
```

## Living Documentation

BDD scenarios serve as:

1. **Executable Specifications**: Automated tests that verify behavior
2. **Documentation**: Up-to-date description of how the system works
3. **Common Language**: Shared vocabulary between business and technical teams
4. **Regression Suite**: Safety net when making changes

### Example: Living Documentation

```gherkin
Feature: Promotional Discount Application
  To attract customers and increase sales
  As a marketing manager
  I want to offer promotional discounts

  Rule: Percentage discounts apply to order subtotal
    Example: 20% off for orders over $100
      Given I have a $150 order
      When I apply a "20% off" promotion
      Then my discount should be $30
      And my order total should be $120

  Rule: Minimum purchase amount must be met
    Example: Promotion requires $50 minimum
      Given I have a $40 order
      When I try to apply a "$50 minimum" promotion
      Then the promotion should not apply
      And I should see "Minimum purchase not met"

  Rule: Only one promotion per order
    Example: Cannot stack multiple promotions
      Given I have a $100 order
      And I have applied "10% off"
      When I try to apply "Free shipping"
      Then I should see "One promotion per order"
      And only "10% off" should be applied
```

## Ubiquitous Language

Develop and use a shared vocabulary:

❌ **Technical Jargon**:

```
"When the user submits the form, we validate the input,
hash the password with bcrypt, insert a record into the
users table, and return a 201 response."
```

✅ **Ubiquitous Language**:

```
"When a customer registers, we verify their information,
create their account, and send a welcome email."
```

### Building Ubiquitous Language

**Discover terms through conversation:**

- What do you call this?
- What's the difference between X and Y?
- When does this state change?

**Document terms in scenarios:**

```gherkin
# Use "Member" not "User" (business term)
Given I am a Gold Member

# Use "Place order" not "Submit order" (domain term)
When I place an order

# Use "Pending" not "In progress" (system state)
Then the order should be Pending
```

**Keep a glossary:**

```
Member: A customer with a subscription
Guest: A customer without a subscription
Order: A collection of items ready for purchase
Cart: A temporary collection of items being considered
```

## Example Mapping

A workshop technique to explore features with examples:

### The Four Colors

**Yellow Cards**: User Stories/Features
**Blue Cards**: Rules (acceptance criteria)
**Green Cards**: Examples (scenarios)
**Red Cards**: Questions (uncertainties)

### Example Mapping Session

**Story**: User registration

**Rules** (Blue):

- Email must be unique
- Password must be strong
- Age must be 18+

**Examples** (Green):

- Register with valid details → Success
- Register with existing email → Error
- Register with weak password → Error
- Register under 18 → Error

**Questions** (Red):

- Do we verify email addresses?
- What defines a "strong" password?
- Do we need parent consent for minors?

## Specification by Example

Use concrete examples to drive development:

### Vague Requirement

"Users should be able to search for products."

### Specification by Example

```gherkin
Scenario: Search by product name
  Given products "Laptop", "Mouse", "Keyboard" exist
  When I search for "lap"
  Then I should see "Laptop" in results
  But I should not see "Mouse" or "Keyboard"

Scenario: Search with no results
  Given products "Laptop", "Mouse" exist
  When I search for "phone"
  Then I should see "No results found"

Scenario: Search is case-insensitive
  Given a product "Laptop" exists
  When I search for "LAPTOP"
  Then I should see "Laptop" in results
```

## Outside-In Development

Start from the outside (user-facing behavior) and work inward:

1. **Write a failing scenario** (acceptance test)
2. **Write a failing unit test** (for the layer you're working on)
3. **Write minimum code** to make unit test pass
4. **Refactor**
5. **Repeat** until scenario passes

```
Scenario (Acceptance) ─┐
                       ├─> Controller Test ─┐
                       │                    ├─> Service Test ─┐
                       │                    │                 ├─> Code
                       │                    │                 │
                       │                    ├─ Service        │
                       │                    │                 │
                       ├─ Controller        │                 │
                       │                    │                 │
Scenario Passes ───────┴────────────────────┴─────────────────┘
```

## BDD vs TDD

**TDD** (Test-Driven Development):

- Developer-focused
- Tests implementation
- Red-Green-Refactor cycle
- Unit tests guide design

**BDD** (Behavior-Driven Development):

- Business-focused
- Tests behavior
- Conversation-Specification-Automation
- Scenarios guide development

**They complement each other:**

- BDD: What should we build? (outside-in)
- TDD: How should we build it? (inside-out)

## Key Principles

1. **Collaboration is essential** - BDD requires active participation from business, development, and testing
2. **Examples clarify requirements** - Concrete examples reveal ambiguities and edge cases
3. **Automate what matters** - Not everything needs to be automated, focus on high-value scenarios
4. **Think behaviors, not tests** - Describe what the system does, not how it's tested
5. **Iterate and refine** - Scenarios evolve as understanding deepens
6. **Keep scenarios maintainable** - Write clear, focused scenarios that are easy to update

## Common Misconceptions

❌ "BDD is just testing with Cucumber"
✅ BDD is a collaborative practice; tools are just enablers

❌ "BDD means writing tests before code"
✅ BDD means discovering requirements through examples before implementation

❌ "BDD scenarios should test everything"
✅ BDD scenarios should document key behaviors; use unit tests for details

❌ "Only testers write scenarios"
✅ Business, developers, and testers collaborate on scenarios

❌ "BDD slows down development"
✅ BDD reduces rework by building the right thing the first time

## Benefits of BDD

- **Reduced rework**: Build the right thing from the start
- **Better collaboration**: Shared understanding across roles
- **Living documentation**: Always up-to-date specifications
- **Faster onboarding**: New team members learn from scenarios
- **Regression safety**: Automated scenarios catch breaking changes
- **Business confidence**: Stakeholders see value being delivered

Remember: BDD is fundamentally about communication and collaboration. The goal is to build software that delivers real value by ensuring everyone has a shared understanding of what needs to be built.
