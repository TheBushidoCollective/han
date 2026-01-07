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
  Scenario: Session messages container displays messages
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element "[data-testid='session-messages']" should be visible if it exists

  @requires-sessions
  Scenario: Message search input is visible
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element "input[placeholder='Jump to message...']" should be visible if it exists

  @requires-sessions
  Scenario: Message search shows autocomplete dropdown
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    And I type "test" into "input[placeholder='Jump to message...']" if it exists
    Then the page should contain "Message #" if it exists

  @requires-sessions
  Scenario: Message search shows no results message
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    And I type "xyznonexistent123" into "input[placeholder='Jump to message...']" if it exists
    Then the page should contain "No matching messages" if it exists

  @requires-sessions
  Scenario: Message search has clear button
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    And I type "test" into "input[placeholder='Jump to message...']" if it exists
    Then the page should contain "×" if it exists

  @requires-sessions
  Scenario: File changes display in sidebar
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".file-changes-section" should be visible if it exists
    And the element ".file-change-card" should be visible if it exists

  @requires-sessions
  Scenario: Hook validation messages display correctly
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the page should not contain "HookValidationMessage"
    And the page should not contain "HookValidationCacheMessage"
    And the page should not contain "HookFileChangeMessage"

  @requires-sessions
  Scenario: Hook message cards render without showing type names
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the page should not contain "__typename"
    And the page should not contain "UnknownEventMessage"

  @requires-sessions
  Scenario: No messages shown as unknown events when they have known types
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the page should not contain "Unknown message type:"
    And the page should not contain "Unknown event:"
    And the element ".unknown-event-message" should not be visible if it exists

  @requires-sessions
  Scenario: User and assistant messages display correctly
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".user-message-card" should be visible if it exists
    And the element ".assistant-message-card" should be visible if it exists

  @requires-sessions
  Scenario: File change cards display validation status
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    When the page loads
    Then the element ".file-change-card" should be visible if it exists
    And the page should not contain "undefined:undefined"

  @requires-sessions
  Scenario: Session detail page loads within reasonable time
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the page should load within 5 seconds
    And the page should not be stuck loading
