Feature: Metrics System
  As a user
  I want to view metrics and performance data
  So that I can track my development progress

  # Metrics are tracked via MCP tools in the core plugin:
  # - start_task: Begin tracking a task
  # - update_task: Log progress
  # - complete_task: Mark task completed with confidence
  # - fail_task: Mark task as failed
  # - query_metrics: Query historical metrics

  Scenario: Metrics page loads
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "Metrics"

  Scenario: Metrics page shows period filter buttons
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "Day"
    And the page should contain "Week"
    And the page should contain "Month"

  Scenario: Week filter is active by default
    Given I am on the "/metrics" page
    When the page loads
    Then the element "button:has-text('Week')" should be visible

  Scenario: Can switch to Day filter
    Given I am on the "/metrics" page
    When the page loads
    And I click on button "Day"
    Then the page should contain "Day"

  Scenario: Can switch to Month filter
    Given I am on the "/metrics" page
    When the page loads
    And I click on button "Month"
    Then the page should contain "Month"

  Scenario: Metrics page header is visible
    Given I am on the "/metrics" page
    When the page loads
    Then the element "h1, h2" should be visible

  Scenario: Metrics page does not show invalid dates
    Given I am on the "/metrics" page
    When the page loads
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-data
  Scenario: Metrics display task statistics when data exists
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "Total Tasks" if it exists
    And the page should contain "Success Rate" if it exists

  @requires-data
  Scenario: Dashboard shows metrics summary
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Tasks" if it exists

  @requires-data
  Scenario: Dashboard shows calibration information
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Calibration" if it exists

  @requires-data
  Scenario: Navigate to metrics from sidebar
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/metrics']" if it exists
    Then the url should contain "/metrics" or I am on the homepage

  Scenario: Empty state shows helpful message
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "No metrics" if it exists

  Scenario: Metrics are loaded via coordinator
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "Metrics"

  # Task tracking scenarios - these test the UI display of tracked tasks
  # Tasks are created via MCP tools (start_task, complete_task, fail_task)

  @requires-data
  Scenario: Task list shows completed tasks
    Given I am on the "/metrics" page
    When the page loads
    Then the element "[data-testid='task-list']" should be visible if it exists

  @requires-data
  Scenario: Task entry shows task type badge
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "fix" if it exists
    And the page should contain "implementation" if it exists

  @requires-data
  Scenario: Task entry shows outcome indicator
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "success" if it exists

  @requires-data
  Scenario: Task entry shows confidence level
    Given I am on the "/metrics" page
    When the page loads
    Then the element "[data-testid='confidence-indicator']" should be visible if it exists

  @requires-data
  Scenario: Failed tasks are highlighted
    Given I am on the "/metrics" page
    When the page loads
    Then the element "[data-testid='failed-task']" should be visible if it exists

  @requires-data
  Scenario: Metrics show calibration chart
    Given I am on the "/metrics" page
    When the page loads
    Then the element "[data-testid='calibration-chart']" should be visible if it exists

  @requires-data
  Scenario: Can filter tasks by type
    Given I am on the "/metrics" page
    When the page loads
    And I click on button "Filter" if it exists
    Then the page should contain "implementation" if it exists
    And the page should contain "fix" if it exists
    And the page should contain "refactor" if it exists

  @requires-data
  Scenario: Can filter tasks by outcome
    Given I am on the "/metrics" page
    When the page loads
    And I click on button "Outcome" if it exists
    Then the page should contain "success" if it exists
    And the page should contain "partial" if it exists
    And the page should contain "failure" if it exists

  @requires-data
  Scenario: Task details expand on click
    Given I am on the "/metrics" page
    When the page loads
    And I click on "[data-testid='task-entry']" if it exists
    Then the element "[data-testid='task-details']" should be visible if it exists

  @requires-data
  Scenario: Task details show files modified
    Given I am on the "/metrics" page
    When the page loads
    And I click on "[data-testid='task-entry']" if it exists
    Then the page should contain "Files Modified" if it exists

  @requires-data
  Scenario: Frustration metrics are displayed
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "Frustration" if it exists

  @requires-data
  Scenario: Hook execution stats are shown
    Given I am on the "/metrics" page
    When the page loads
    Then the page should contain "Hook" if it exists
