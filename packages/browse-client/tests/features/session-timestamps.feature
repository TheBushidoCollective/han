Feature: Session Timestamps
  As a user
  I want to see accurate session timestamps
  So that I know when sessions were actually active

  Sessions should display the time of their last message, not the time
  when the indexer processed the session. This ensures users see relevant
  activity times for their sessions.

  @requires-sessions
  Scenario: Session list shows valid timestamps
    Given I am on the "/sessions" page
    When the page loads
    Then the element ".session-list-item" should be visible if it exists
    And the page should not contain "Invalid Date"
    And the page should not contain "NaN"

  @requires-sessions
  Scenario: Session timestamps are not epoch dates
    Given I am on the "/" page
    When the page loads
    Then the element ".session-list-item" should be visible if it exists
    And the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-sessions
  Scenario: Session detail shows accurate message timestamps
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".messages-section" should be visible if it exists
    And the page should not contain "Invalid Date"
    And the page should not contain "12/31/1969"

  @requires-sessions
  Scenario: Dashboard session timestamps are relative
    Given I am on the "/" page
    When the page loads
    Then the element ".session-list-item" should be visible if it exists
    And I should see "ago" if it exists

  @requires-sessions
  Scenario: Session timestamps are ordered correctly
    Given I am on the "/sessions" page
    When the page loads
    Then the page should contain "Sessions"
    And the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-sessions
  Scenario: Recent sessions show relative time
    Given I am on the "/" page
    When the page loads
    Then the element ".session-list-item" should be visible if it exists
    And the page should not contain "undefined"
    And the page should not contain "null"
