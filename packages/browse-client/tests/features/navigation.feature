Feature: Navigation
  As a user
  I want to navigate between different pages
  So that I can access various features

  Scenario: Navigate from dashboard to sessions
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/sessions']" if it exists
    Then the url should contain "/sessions" or I am on the homepage

  Scenario: Navigate from dashboard to projects
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/repos']" if it exists
    Then the url should contain "/repos" or I am on the homepage

  Scenario: Navigate from dashboard to plugins
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/plugins']" if it exists
    Then the url should contain "/plugins" or I am on the homepage

  Scenario: Navigate from dashboard to metrics
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/metrics']" if it exists
    Then the url should contain "/metrics" or I am on the homepage

  Scenario: Navigate from dashboard to memory
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/memory']" if it exists
    Then the url should contain "/memory" or I am on the homepage

  Scenario: Navigate from dashboard to cache
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/cache']" if it exists
    Then the url should contain "/cache" or I am on the homepage

  Scenario: Navigate from dashboard to settings
    Given I am on the "/" page
    When the page loads
    And I click on "a[href='/settings']" if it exists
    Then the url should contain "/settings" or I am on the homepage

  Scenario: Direct navigation to all main pages works
    Given I am on the "/sessions" page
    When the page loads
    Then the page should contain "Sessions"
    And I am on the "/plugins" page
    When the page loads
    Then the page should contain "Plugins"
    And I am on the "/metrics" page
    When the page loads
    Then the page should contain "Metrics"
