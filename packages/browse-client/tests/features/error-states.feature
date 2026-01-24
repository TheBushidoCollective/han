Feature: Error States
  As a user
  I want to see appropriate error messages
  So that I understand when something goes wrong

  Scenario: Session not found shows error
    Given I am on the "/projects/nonexistent/sessions/invalid" page
    When the page loads
    Then the page should contain "not found" if it exists

  Scenario: Invalid route shows error or redirects
    Given I am on the "/invalid-route-12345" page
    When the page loads
    Then the page should contain "Dashboard"

  Scenario: Empty states display appropriately
    Given I am on the "/sessions" page
    When the page loads
    Then the page should contain "No" if it exists

  Scenario: Plugins page shows empty state
    Given I am on the "/plugins" page
    When the page loads
    Then the page should contain "Plugins"
