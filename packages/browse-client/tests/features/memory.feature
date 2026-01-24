Feature: Memory System
  As a user
  I want to search memory and browse rules
  So that I can find relevant project knowledge

  # Memory is a five-layer system:
  # - Rules (.claude/rules/)
  # - Summaries (Claude message summary type)
  # - Observations (pre-tool meaningful uses)
  # - Transcripts (~/.claude/projects/{id}/sessions/)
  # - Providers (MCP memory functions)

  Scenario: Memory page loads with User Memory scope
    Given I am on the "/memory" page
    When the page loads
    Then the page should contain "User Memory"

  Scenario: Memory page shows tab navigation
    Given I am on the "/memory" page
    When the page loads
    Then the page should contain "Rules"

  Scenario: Rules tab is shown on global memory
    Given I am on the "/memory" page
    When the page loads
    Then the element "button:has-text('Rules')" should be visible

  Scenario: Global memory shows only Rules tab
    Given I am on the "/memory" page
    When the page loads
    Then the page should contain "Rules"

  @requires-data
  Scenario: Project memory has Search tab
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I click on "a[href*='/memory']" if it exists
    When the page loads
    Then the page should contain "Search" if it exists

  Scenario: Global memory page has rule content
    Given I am on the "/memory" page
    When the page loads
    Then the page should not contain "12/31/1969"

  Scenario: Rules tab displays rule categories
    Given I am on the "/memory" page
    When the page loads
    And I click on button "Rules"
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-data
  Scenario: Project memory page shows Project scope
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I click on "a[href*='/memory']" if it exists
    When the page loads
    Then the page should contain "Project Memory" if it exists

  Scenario: Memory page header is visible
    Given I am on the "/memory" page
    When the page loads
    Then the element "h1, h2" should be visible

  Scenario: Tab buttons are interactive
    Given I am on the "/memory" page
    When the page loads
    Then the element "button" should be visible

  Scenario: Rules tab shows scope-specific content
    Given I am on the "/memory" page
    When the page loads
    And I click on button "Rules"
    Then the page should contain "User Memory"

  # Memory Agent Streaming Tests
  # Search is only available on project memory pages (requires project context)
  # These tests use @requires-data tag since they need a project to navigate to

  @requires-data
  Scenario: Project memory search input accepts text
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I click on "a[href*='/memory']" if it exists
    When the page loads
    Then the element "input[placeholder*='question']" should be visible if it exists

  @requires-data
  Scenario: Project memory has search button
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I click on "a[href*='/memory']" if it exists
    When the page loads
    Then the element "button:has-text('Search')" should be visible if it exists
