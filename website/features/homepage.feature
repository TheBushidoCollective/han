Feature: Website Homepage
  As a visitor
  I want to view the Han homepage
  So that I can learn about the plugin marketplace

  Scenario: Homepage loads with correct content
    Given I am on the "/" page
    Then the page title should contain "Han"
    And the main heading should contain "Releasable Code"

  Scenario: Homepage navigation links are visible
    Given I am on the "/" page
    Then I should see a link to "Plugins"
    And I should see a link to "GitHub"

  Scenario: Navigate from homepage to plugins page
    Given I am on the "/" page
    When I click on link "Plugins"
    Then the url should contain "/plugins"
