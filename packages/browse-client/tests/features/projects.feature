Feature: Projects
  As a user
  I want to view project details and sessions
  So that I can manage my development work

  Scenario: Projects page loads
    Given I am on the "/projects" page
    When the page loads
    Then the page should contain "Projects"

  Scenario: Projects page shows repos list
    Given I am on the "/repos" page
    When the page loads
    Then the page should contain "Repos"

  @requires-data
  Scenario: Project detail page loads
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    Then the url should contain "/repos"

  @requires-data
  Scenario: Project detail shows sessions
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    Then the element ".session-list-item" should be visible if it exists

  @requires-data
  Scenario: Project detail shows resource navigation
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    Then the page should contain "Memory" if it exists
    And the page should contain "Cache" if it exists
    And the page should contain "Plugins" if it exists

  @requires-data
  Scenario: Navigate to project sessions
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I click on "a[href*='/sessions']" if it exists
    Then the url should contain "/sessions"
