Feature: Website Navigation
  As a user
  I want to navigate between different sections
  So that I can find the information I need

  Scenario Outline: Navigate between main sections
    Given I am on the "/" page
    When I click on link "<section>"
    Then the url should contain "<url_fragment>"

    Examples:
      | section | url_fragment |
      | Plugins | /plugins     |

  Scenario: Cross-section navigation works
    Given I am on the "/docs" page
    When I navigate to "/plugins"
    Then the url should contain "/plugins"
    And I should see heading "Plugin Marketplace"
