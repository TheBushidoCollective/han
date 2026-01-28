# Playwright MCP

MCP server configuration for Playwright integration providing test automation,
browser control, and test execution capabilities.

## IMPORTANT: Use Dedicated Agents

**The main orchestrator should NEVER call Playwright MCP tools directly.**

Playwright tools return extremely verbose output (page snapshots, DOM trees,
network logs) that will fill up your context window. Instead, delegate to
specialized agents that process this output and return concise summaries.

### Available Agents

#### `test-generator`

Generates Playwright test cases from requirements and user flows.

**When to use:**

- Creating new test suites from scratch
- Converting manual test cases to automated tests
- Generating tests from user stories or specifications
- Building regression test coverage

**Returns:** Concise summary with file paths and test names created.

#### `ui-debugger`

Debugs UI issues using Playwright inspection and browser automation.

**When to use:**

- Investigating failing tests
- Debugging flaky tests (intermittent failures)
- Troubleshooting selector problems
- Analyzing element visibility issues
- Inspecting page state

**Returns:** Concise summary with root cause and recommended fix.

### Example Usage

Instead of calling Playwright tools directly:

```
# BAD - fills context with verbose page snapshots
mcp__playwright__browser_navigate(url="https://example.com")
mcp__playwright__browser_snapshot()  # Returns thousands of lines
```

Delegate to an agent:

```
# GOOD - agent handles verbose output internally
Task: Use the test-generator agent to create tests for the login flow
Task: Use the ui-debugger agent to investigate why the checkout test is failing
```

## MCP Integration

This plugin provides MCP (Model Context Protocol) server integration.

The MCP configuration is defined in `.mcp.json` and provides tools and
resources through the MCP protocol.

## Installation

Install with han CLI:

```bash
han plugin install hashi-playwright-mcp
```
