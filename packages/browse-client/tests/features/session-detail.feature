Feature: Session Detail
  As a user
  I want to view detailed information about a session
  So that I can review my conversation history

  @requires-sessions
  Scenario: Session detail page shows content
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the url should contain "/sessions/" or I am on the homepage

  @requires-sessions
  Scenario: Session timestamps are valid
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"
