Feature: Plugin Pages
  As a user
  I want to browse plugins
  So that I can find tools to enhance my workflow

  Background:
    Given I am on the "/plugins" page

  Scenario: Plugins page loads with marketplace heading
    Then I should see heading "Plugin Marketplace"

  Scenario: Plugin categories are displayed
    Then I should see a link to "Core"
    And I should see a link to "Languages"

  Scenario: Navigate to core category
    When I click on link "Core"
    Then the url should contain "/plugins/core"
    And I should see heading "Core"

  Scenario: View plugins in tools category
    When I navigate to "/plugins/tools"
    Then I should see at least 1 "a[href*='/plugins/tools/']" elements

  Scenario: Plugin detail page shows information
    When I navigate to "/plugins/core/core"
    Then the element "h1" should be visible
    And I should see heading "Installation"

  Scenario: Plugin detail page has skills section
    When I navigate to "/plugins/core/core"
    Then I should see heading "Skills" if it exists
