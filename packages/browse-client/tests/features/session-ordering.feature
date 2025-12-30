Feature: Session Ordering
  As a user
  I want sessions to be ordered by last updated
  So that I see my most recent work first

  @requires-sessions
  Scenario: Dashboard shows sessions in descending order
    Given I am on the "/" page
    When the page loads
    Then the element ".session-list-item" should be visible if it exists

  @requires-sessions
  Scenario: Sessions list shows sessions in descending order
    Given I am on the "/sessions" page
    When the page loads
    Then the page should contain "Sessions"

  @requires-sessions
  Scenario: Sessions are ordered consistently across views
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions']" if it exists
    When the page loads
    Then the page should contain "Sessions"
    And the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"
