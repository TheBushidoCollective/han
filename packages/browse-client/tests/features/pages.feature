Feature: Page Navigation
  As a user
  I want to navigate between different pages
  So that I can access various features

  Scenario: Plugins page loads
    Given I am on the "/plugins" page
    When the page loads
    Then the page should contain "Plugins"

  Scenario: Settings page loads
    Given I am on the "/settings" page
    When the page loads
    Then the page should contain "Settings"

  Scenario: Projects page loads
    Given I am on the "/projects" page
    When the page loads
    Then the page should contain "Projects"

  Scenario: Repos page loads
    Given I am on the "/repos" page
    When the page loads
    Then the page should contain "Repos"

  Scenario: Metrics page loads
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "Metrics"

  Scenario: Memory page loads
    Given I am on the "/memory" page
    When the page loads
    Then the page should contain "Memory"

  Scenario: Cache page loads
    Given I am on the "/cache" page
    When the page loads
    Then the page should contain "Cache"

  Scenario: Sessions page loads
    Given I am on the "/sessions" page
    When the page loads
    Then the page should contain "Sessions"
