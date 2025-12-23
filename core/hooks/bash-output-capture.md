# Bash Output Capture

**When running bash commands, pipe output to a file instead of using head or tail.**

## Why This Matters

Using `head` or `tail` to truncate command output causes you to miss critical information:

- Build errors may appear at the end after a long list of warnings
- Test failures may be scattered throughout the output
- Log patterns require full context to diagnose correctly
- Error counts and summaries are often at the end

## Required Pattern

```bash
# ✅ CORRECT: Capture full output to file, then read
command > /tmp/output.log 2>&1
# Use the Read tool to examine /tmp/output.log

# ❌ WRONG: Truncating output with head/tail
command | head -100
command | tail -50
command 2>&1 | head
```

## When To Apply

- Running test suites
- Build commands
- Linting with many issues
- Any command that may produce extensive output

## Output Files

Use descriptive names in `/tmp/`:

- `/tmp/test-output.log` - Test results
- `/tmp/build-output.log` - Build output
- `/tmp/lint-output.log` - Linter results

Then use the Read tool to examine the full output and understand the complete picture before taking action.
