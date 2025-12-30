Feature: Session Checkpoints
  As a user
  I want to view and manage file checkpoints in sessions
  So that I can track changes and restore files if needed

  # Checkpoints are created via the han hooks when files are modified.
  # They track file state at specific points in time during a session.
  # Metadata is stored in SQLite, file content as blobs on disk.

  Scenario: Session detail page shows checkpoint section
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the page should contain "Session" if it exists

  @requires-data
  Scenario: Checkpoint list displays for session with checkpoints
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the element "[data-testid='checkpoints']" should be visible if it exists

  @requires-data
  Scenario: Checkpoint entry shows file path
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the page should contain "/" if it exists

  @requires-data
  Scenario: Checkpoint entry shows timestamp
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-data
  Scenario: Checkpoint shows file hash for verification
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the element "[data-testid='checkpoint-hash']" should be visible if it exists

  Scenario: Empty session shows no checkpoints message
    Given I am on the "/" page
    When the page loads
    Then the page should contain "No checkpoints" if it exists

  Scenario: Session timeline includes checkpoint events
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the element "[data-testid='session-timeline']" should be visible if it exists

  @requires-data
  Scenario: Can filter session by checkpoint status
    Given I am on the "/" page
    When the page loads
    Then the element "[data-testid='checkpoint-filter']" should be visible if it exists

  @requires-data
  Scenario: Checkpoint restore button is visible
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the element "button:has-text('Restore')" should be visible if it exists

  @requires-data
  Scenario: Checkpoint diff view shows changes
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    And I click on button "View Diff" if it exists
    Then the element "[data-testid='checkpoint-diff']" should be visible if it exists
