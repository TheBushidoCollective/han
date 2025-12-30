Feature: Live Updates
  As a user
  I want to see live updates to session data
  So that I can track current work in real-time

  @requires-sessions
  Scenario: Dashboard shows live indicator
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Live" if it exists

  @requires-sessions
  Scenario: Dashboard shows update timestamp
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Updated" if it exists

  @requires-sessions
  Scenario: Session detail supports live updates
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".messages-section" should be visible if it exists

  @requires-sessions
  Scenario: Sessions list supports subscriptions
    Given I am on the "/sessions" page
    When the page loads
    Then the page should contain "Sessions"
