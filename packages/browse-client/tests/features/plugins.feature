Feature: Plugins
  As a user
  I want to view and manage plugins
  So that I can extend Han's functionality

  Scenario: Plugins page loads
    Given I am on the "/plugins" page
    When the page loads
    Then the page should contain "Plugins"

  Scenario: Plugins page shows stats
    Given I am on the "/plugins" page
    When the page loads
    Then the page should contain "plugins"

  @requires-data
  Scenario: Plugin cards display
    Given I am on the "/plugins" page
    When the page loads
    Then the element ".plugin-card" should be visible if it exists

  @requires-data
  Scenario: Plugin cards link to han.guru
    Given I am on the "/plugins" page
    When the page loads
    Then I should see link with href "han.guru" if it exists

  Scenario: Plugin search is available
    Given I am on the "/plugins" page
    When the page loads
    Then the element "input[placeholder*='Search']" should be visible if it exists

  @requires-data
  Scenario: Filter plugins by scope
    Given I am on the "/plugins" page
    When the page loads
    And I click on button "User" if it exists
    Then the page should contain "plugins"

  @requires-data
  Scenario: Search for plugins
    Given I am on the "/plugins" page
    When the page loads
    And I type "core" into "input[placeholder*='Search']" if it exists
    Then the page should contain "plugins"

  Scenario: Plugin installation hint is shown
    Given I am on the "/plugins" page
    When the page loads
    And I wait for 3 seconds
    Then the page should contain "han plugin install" if it exists

  @requires-data
  Scenario: Plugin categories are displayed
    Given I am on the "/plugins" page
    When the page loads
    Then the element ".stat-card" should be visible if it exists

  @requires-data
  Scenario: Navigate to project plugins
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I navigate to "plugins"
    When the page loads
    Then the page should contain "Plugins" if it exists
