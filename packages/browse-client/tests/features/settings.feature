Feature: Settings
  As a user
  I want to view and modify settings
  So that I can configure Han to my preferences

  Scenario: Settings page loads
    Given I am on the "/settings" page
    When the page loads
    Then the page should contain "Settings"

  Scenario: Global settings page is accessible
    Given I am on the "/settings" page
    When the page loads
    Then the page should contain "Settings"

  @requires-data
  Scenario: Project settings page loads
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I navigate to "settings"
    When the page loads
    Then the page should contain "Settings"

  Scenario: Settings page shows content
    Given I am on the "/settings" page
    When the page loads
    Then the page should contain "Settings"
