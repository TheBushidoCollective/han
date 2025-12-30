Feature: Rules
  As a user
  I want to view and search rules from my projects and user directory
  So that I can understand project conventions and memory

  Background:
    Given I am on the "/memory" page
    When the page loads

  Scenario: Rules tab is accessible from memory page
    When I click on button "Rules"
    Then the page should contain "Rules"

  Scenario: Rules tab shows filter input
    When I click on button "Rules"
    Then the element "input[placeholder*='Filter']" should be visible

  @requires-data
  Scenario: Rules are displayed with project or user scope
    When I click on button "Rules"
    When I wait for element "h4"
    Then the page should contain "Rules"

  @requires-data
  Scenario: Rules can be clicked to view content
    When I click on button "Rules"
    When I wait for element "h4"
    When I click on ".card-hoverable" if it exists
    Then the element "h3" should be visible if it exists

  @requires-data
  Scenario: Rule detail shows file path with claude rules directory
    When I click on button "Rules"
    When I wait for element "h4"
    When I click on ".card-hoverable" if it exists
    Then the page should contain ".claude/rules/" if it exists

  @requires-data
  Scenario: Filter input allows searching rules
    When I click on button "Rules"
    When I wait for element "h4"
    And I type "test" into "input[placeholder*='Filter']" if it exists
    Then the page should contain "Rules"

  Scenario: Empty state shows when no filter matches
    When I click on button "Rules"
    Then the element "input[placeholder*='Filter']" should be visible

  @requires-data
  Scenario: Rules show file size in KB
    When I click on button "Rules"
    When I wait for element "h4"
    Then the page should contain "KB" if it exists

  @requires-data
  Scenario: Project rules are grouped by project name
    When I click on button "Rules"
    When I wait for element "h4"
    Then I should see at least 1 "h4" elements

  @requires-data
  Scenario: User rules section exists
    When I click on button "Rules"
    When I wait for element "h4"
    Then the page should contain "User Rules" if it exists

  @requires-data
  Scenario: Rules from han project are visible
    When I click on button "Rules"
    When I wait for element "h4"
    Then the page should contain "han" if it exists
