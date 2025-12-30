Feature: Cache
  As a user
  I want to view cache information
  So that I can understand what data is cached

  # Cache shows hook run results that are cached to avoid
  # re-running hooks when files haven't changed.

  Scenario: Cache page loads
    Given I am on the "/cache" page
    When the page loads
    Then the page should contain "Cache"

  Scenario: Cache page is accessible from navigation
    Given I am on the "/" page
    When the page loads
    And I navigate to "/cache"
    Then the page should contain "Cache"

  Scenario: Cache page does not show invalid dates
    Given I am on the "/cache" page
    When the page loads
    Then the page should not contain "12/31/1969"
    And the page should not contain "1/1/1970"

  @requires-data
  Scenario: Project cache page loads
    Given I am on the "/repos" page
    When the page loads
    And I click on "a[href*='/repos/']" if it exists
    When the page loads
    And I navigate to "cache"
    When the page loads
    Then the page should contain "Cache" if it exists
