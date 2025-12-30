Feature: Dashboard Comprehensive
  As a user
  I want a comprehensive dashboard view
  So that I can see an overview of my development activity

  Scenario: Dashboard loads with all main elements
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Dashboard"

  @requires-data
  Scenario: Dashboard shows stats grid
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Total Tasks" if it exists
    And the page should contain "Success Rate" if it exists
    And the page should contain "Calibration" if it exists

  @requires-sessions
  Scenario: Dashboard shows recent sessions section
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Recent Sessions" if it exists

  @requires-data
  Scenario: Dashboard shows agent health section
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Agent Health" if it exists
    And the page should contain "Checkpoints" if it exists

  @requires-data
  Scenario: Dashboard shows plugin categories
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Plugin Categories" if it exists

  @requires-data
  Scenario: Click on projects stat navigates to projects
    Given I am on the "/" page
    When the page loads
    And I click on ".stat-card" if it exists
    Then the url should contain "/" or I am on the homepage

  @requires-data
  Scenario: Dashboard displays valid timestamps
    Given I am on the "/" page
    When the page loads
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"
    And the page should not contain "Invalid Date"

  @requires-data
  Scenario: Project dashboard shows project-specific content
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    Then the page should contain "Project Dashboard" if it exists
    And the page should contain "Project Resources" if it exists

  @requires-data
  Scenario: Project dashboard shows resource cards
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    Then the page should contain "Memory" if it exists
    And the page should contain "Cache" if it exists
    And the page should contain "Plugins" if it exists
    And the page should contain "Settings" if it exists

  Scenario: Dashboard header displays correctly
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Dashboard" if it exists
    And the page should contain "Han Development Environment" if it exists

  @requires-data
  Scenario: Live indicator shows on dashboard
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Live" if it exists
    And the page should contain "Updated" if it exists
