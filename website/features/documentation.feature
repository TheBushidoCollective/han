Feature: Documentation Pages
  As a user
  I want to access documentation
  So that I can learn how to use Han

  Scenario: Documentation page loads successfully
    Given I am on the "/docs" page
    Then the url should contain "/docs"

  Scenario: Plugin categories are accessible from docs
    Given I am on the "/plugins" page
    Then I should see at least 1 "a[href*='/plugins/']" elements
