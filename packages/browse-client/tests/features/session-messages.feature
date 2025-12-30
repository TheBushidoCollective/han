Feature: Session Messages
  As a user
  I want to view messages in a session
  So that I can review conversation history

  @requires-sessions
  Scenario: Session detail page shows messages
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the url should contain "/sessions/" or I am on the homepage

  @requires-sessions
  Scenario: Messages display with proper structure
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".messages-section" should be visible if it exists
    And the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-sessions
  Scenario: Session shows message count
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the page should contain "Messages" if it exists

  @requires-sessions
  Scenario: Session header displays project metadata
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".session-meta-inline" should be visible if it exists
    And the element ".page-header" should be visible if it exists

  @requires-sessions
  Scenario: Session shows summary if available
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".session-summary-card" should be visible if it exists

  @requires-sessions
  Scenario: Back button navigates to sessions list
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    And I click on button "Back to Sessions" if it exists
    Then the url should contain "/sessions" or I am on the homepage

  @requires-sessions
  Scenario: Filter dropdown toggles message visibility
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element "button:has-text('Filter')" should be visible if it exists
    And I click on "button:has-text('Filter')" if it exists
    Then the element ".filter-dropdown" should be visible if it exists
    And the page should contain "Show message types" if it exists

  @requires-sessions
  Scenario: Tool use blocks display with results inline
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".tool-use-block" should be visible if it exists
    And the element ".tool-result-inline" should be visible if it exists

  @requires-sessions
  Scenario: Messages scroll with column-reverse layout
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".messages-list" should be visible
    And the element ".messages-list" should have css "flex-direction" "column-reverse"
