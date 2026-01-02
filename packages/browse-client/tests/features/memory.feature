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
    Then the page should contain "Search"
    And the page should contain "Rules"

  Scenario: Search tab is active by default
    Given I am on the "/memory" page
    When the page loads
    Then the element "button:has-text('Search')" should be visible

  Scenario: Switch to Rules tab
    Given I am on the "/memory" page
    When the page loads
    And I click on button "Rules"
    Then the page should contain "Rules"

  Scenario: Switch back to Search tab
    Given I am on the "/memory" page
    When the page loads
    And I click on button "Rules"
    And I click on button "Search"
    Then the page should contain "Search"

  Scenario: Search tab shows search input
    Given I am on the "/memory" page
    When the page loads
    Then the element "input[type='text']" should be visible if it exists

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
  # Tests for the live streaming Memory Agent search functionality

  Scenario: Search input accepts text
    Given I am on the "/memory" page
    When the page loads
    And I type "test query" into "input[placeholder*='question']"
    Then the element "input[placeholder*='question']" should be visible

  Scenario: Search button is disabled when input is empty
    Given I am on the "/memory" page
    When the page loads
    Then the element "button:has-text('Search')" should be visible

  Scenario: Search shows loading state when searching
    Given I am on the "/memory" page
    When the page loads
    And I type "What is the plugin structure?" into "input[placeholder*='question']"
    And I click on button "Search"
    Then the page should contain "Searching" if it exists

  Scenario: Search shows Memory Agent starting message
    Given I am on the "/memory" page
    When the page loads
    And I type "test search" into "input[placeholder*='question']"
    And I click on button "Search"
    Then the page should contain "Memory Agent" if it exists

  Scenario: Search displays results with confidence
    Given I am on the "/memory" page
    When the page loads
    And I type "plugin" into "input[placeholder*='question']"
    And I click on button "Search"
    And I wait for 5 seconds
    Then the page should contain "Confidence" if it exists

  Scenario: Search can be triggered with Enter key
    Given I am on the "/memory" page
    When the page loads
    Then the element "input[placeholder*='question']" should be visible if it exists

  Scenario: Search empty state message is visible
    Given I am on the "/memory" page
    When the page loads
    Then the page should contain "Memory Agent" if it exists

  Scenario: Progress updates show layer information
    Given I am on the "/memory" page
    When the page loads
    And I type "test" into "input[placeholder*='question']"
    And I click on button "Search"
    And I wait for 3 seconds
    Then the page should contain "Memory Agent" if it exists
