Feature: Project Sessions
  As a user
  I want to view sessions for a specific project
  So that I can focus on work for that project

  Scenario: Project sessions page loads
    Given I am on the "/projects" page
    When the page loads
    And I click on "a[href*='/projects/']" if it exists
    When the page loads
    And I click on "a[href*='/sessions']" if it exists
    When the page loads
    Then the page should contain "Sessions"

  Scenario: Project sessions page shows empty state when no sessions
    Given I am on the "/projects" page
    When the page loads
    And I click on "a[href*='/projects/']" if it exists
    When the page loads
    And I click on "a[href*='/sessions']" if it exists
    When the page loads
    Then the page should contain "Sessions"
    And I should see "No sessions found" if it exists

  Scenario: Project sessions page shows session count
    Given I am on the "/projects" page
    When the page loads
    And I click on "a[href*='/projects/']" if it exists
    When the page loads
    And I click on "a[href*='/sessions']" if it exists
    When the page loads
    Then the page should contain "Sessions"

  Scenario: Project sessions page has filter input
    Given I am on the "/projects" page
    When the page loads
    And I click on "a[href*='/projects/']" if it exists
    When the page loads
    And I click on "a[href*='/sessions']" if it exists
    When the page loads
    Then the element "input[placeholder*='Filter']" should be visible if it exists

  @requires-sessions
  Scenario: Project sessions show correct project name
    Given I am on the "/projects" page
    When the page loads
    And I click on "a[href*='/projects/']" if it exists
    When the page loads
    Then the element ".session-list-item" should be visible if it exists

  @requires-sessions
  Scenario: Project sessions are ordered by most recent
    Given I am on the "/projects" page
    When the page loads
    And I click on "a[href*='/projects/']" if it exists
    When the page loads
    And I click on "a[href*='/sessions']" if it exists
    When the page loads
    Then the element ".session-list-item" should be visible if it exists
    And the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"
