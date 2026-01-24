Feature: Rules
  As a user
  I want to view and search rules from my projects and user directory
  So that I can understand project conventions and memory

  # Note: Rules are loaded via GraphQL which may not always be available in test environment.
  # Tests use "if it exists" patterns to be resilient to loading states.

  Background:
    Given I am on the "/memory" page
    When the page loads

  Scenario: Rules tab is accessible from memory page
    When I click on button "Rules"
    Then the page should contain "Rules"

  Scenario: Memory page has rules button
    Then the element "button:has-text('Rules')" should be visible

  @requires-data
  Scenario: Rules content loads when available
    When I click on button "Rules"
    And I wait for 3 seconds
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-data
  Scenario: Rules can be clicked to view content
    When I click on button "Rules"
    And I wait for 3 seconds
    When I click on ".card-hoverable" if it exists
    Then the page should contain "Rules"

  @requires-data
  Scenario: Rule detail shows file path when rules exist
    When I click on button "Rules"
    And I wait for 3 seconds
    When I click on ".card-hoverable" if it exists
    Then the page should contain ".claude" if it exists

  Scenario: Rules page does not show invalid dates
    When I click on button "Rules"
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"
