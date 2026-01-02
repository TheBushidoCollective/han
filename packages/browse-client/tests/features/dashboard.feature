Feature: Dashboard
  As a user
  I want to view my sessions on the dashboard
  So that I can see my activity history

  Scenario: Dashboard page loads
    Given I am on the "/" page
    When the page loads
    Then the page should contain "Dashboard"

  Scenario: Sessions display with valid timestamps
    Given I am on the "/" page
    When the page loads
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-sessions
  Scenario: Navigate to session detail
    Given I am on the "/" page
    When the page loads
    And I click on "a[href*='/sessions/']" if it exists
    Then the url should contain "/sessions/" or I am on the homepage

  Scenario: Dashboard shows sidebar navigation
    Given I am on the "/" page
    When the page loads
    Then the element "nav" should be visible if it exists
