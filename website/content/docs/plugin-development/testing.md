---
title: "Testing Plugins"
description: "How to test your Han plugins locally before distribution, including validation, hook testing, and debugging."
---

Testing your plugin locally ensures it works correctly before sharing it with others. This guide covers validation, hook testing, and debugging techniques.

## Plugin Validation

Han includes a built-in validator to check your plugin structure:

```bash
# Validate current directory
han plugin validate .

# Validate specific plugin
han plugin validate ./path/to/my-plugin
```

The validator checks:

- **Required files exist** - `.claude-plugin/plugin.json`
- **plugin.json is valid** - Valid JSON with required fields
- **Naming conventions** - Plugin name matches directory
- **Hook configuration** - `han-plugin.yml` syntax is correct
- **Skill format** - SKILL.md files have valid frontmatter
- **Command format** - Command files have required frontmatter

### Validation Output

```
Validating plugin: jutsu-my-tool

Checking required files...
  .claude-plugin/plugin.json ... OK
  han-plugin.yml ... OK

Checking plugin.json...
  name: jutsu-my-tool ... OK
  version: 1.0.0 ... OK
  description: present ... OK

Checking hooks...
  lint: command valid ... OK
  lint: dirs_with patterns valid ... OK
  lint: if_changed patterns valid ... OK

Checking skills...
  skills/getting-started/SKILL.md ... OK

Plugin validation passed!
```

## Local Installation

Install your plugin locally to test it in Claude Code:

### Method 1: Local Path Installation

```bash
# Install from local directory
han plugin install --path ./my-plugin

# Or with explicit scope
han plugin install --path ./my-plugin --scope project
```

This creates a symlink to your plugin, so changes are reflected immediately.

### Method 2: Direct Configuration

Add your plugin directly to settings:

**`.claude/settings.json`** (project scope):

```json
{
  "permissions": {
    "allow": []
  },
  "claudePlugins": {
    "localPlugins": [
      {
        "path": "/absolute/path/to/my-plugin"
      }
    ]
  }
}
```

## Testing Hooks

### Run Hooks Manually

Test individual hooks with the `han hook run` command:

```bash
# Run a specific hook
han hook run my-plugin lint

# Run with verbose output
han hook run my-plugin lint --verbose

# Skip caching (force re-run)
han hook run my-plugin lint --no-cache

# Run in a specific directory
han hook run my-plugin lint --directory ./packages/web
```

### Verify Hook Conditions

Test that hooks only run when expected:

```bash
# Create a test file
echo "const x = 1" > test.js

# Run hook - should execute
han hook run my-plugin lint --verbose

# Remove test file
rm test.js

# Run hook - should skip (no matching files)
han hook run my-plugin lint --verbose
```

### Check dirs_with Filtering

```bash
# Without config file - hook should skip
rm -f biome.json
han hook run jutsu-biome lint --verbose
# Expected: "Skipping: no config file found"

# With config file - hook should run
echo '{}' > biome.json
han hook run jutsu-biome lint --verbose
# Expected: Hook executes
```

### Check if_changed Filtering

```bash
# Modify a matching file
touch src/app.ts

# Run hook - should execute
han hook run my-plugin typecheck --verbose

# Without changes - should use cache
han hook run my-plugin typecheck --verbose
# Expected: "Using cached result"
```

## Testing Skills

### Verify Skill Loading

Skills are loaded automatically when relevant. To test:

1. Start a Claude Code session with your plugin installed
2. Ask about your skill's topic
3. Claude should reference the skill content

### Check Frontmatter

Validate skill frontmatter manually:

```bash
# Check SKILL.md has valid YAML frontmatter
head -20 skills/getting-started/SKILL.md
```

Expected output:

```
---
name: getting-started
description: Use when setting up my-tool...
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---
```

## Testing Commands

### Verify Command Registration

Commands should appear in Claude Code's command list:

1. Start Claude Code session
2. Type `/` to see available commands
3. Your plugin's commands should appear

### Test Command Execution

```bash
# In Claude Code
/my-command

# Claude should execute the command workflow
```

## Testing Agents (Do Plugins)

### Verify Agent Loading

1. Install your do-* plugin
2. Ask Claude about your agent's specialty
3. Claude should offer to use the agent

### Test Agent Behavior

Create a test scenario matching your agent's examples:

```
User: "Analyze the auth module for code quality issues"
Expected: Claude invokes your quality-analyzer agent
```

## Testing MCP Servers (Hashi Plugins)

### Verify Server Configuration

Check your `.mcp.json` is valid:

```bash
# Validate JSON
cat .mcp.json | jq .

# Check server can be started
npx -y @your-org/mcp-server-your-service --help
```

### Test Tool Availability

1. Install your hashi-* plugin
2. In Claude Code, check available tools
3. Your MCP server's tools should appear

### Test Memory Provider

If you configured a memory provider:

```bash
# Query memory
han memory query "search term relevant to your service"
```

## Debugging

### Verbose Mode

Enable verbose output for detailed information:

```bash
han hook run my-plugin lint --verbose
```

### Check Hook Status

View hook configuration and state:

```bash
han hook info my-plugin lint
```

Output includes:

- Hook command
- Conditions (dirs_with, if_changed)
- Cache status
- Last run result

### View Cache

Inspect the hook cache:

```bash
# Cache is stored in ~/.han/cache/
ls -la ~/.han/cache/hooks/

# Clear cache to force re-runs
han cache clear --hooks
```

### Check Plugin Registration

Verify your plugin is registered:

```bash
# List all plugins
han plugin list

# Show plugin details
han plugin info my-plugin
```

### Debug Hook Failures

When hooks fail:

1. **Check exit code**: Non-zero means failure

   ```bash
   han hook run my-plugin lint; echo "Exit: $?"
   ```

2. **Run command directly**: Test the underlying command

   ```bash
   npx eslint .
   ```

3. **Check environment**: Verify required tools are installed

   ```bash
   which npx
   npx eslint --version
   ```

4. **Check working directory**: Ensure you're in the right place

   ```bash
   pwd
   ls -la
   ```

## Common Issues

### Hook Not Running

**Symptom**: Hook skips unexpectedly

**Causes**:

- No files match `if_changed` patterns
- Config file not found for `dirs_with`
- Cached result being used

**Solution**:

```bash
# Force re-run
han hook run my-plugin lint --no-cache --verbose
```

### Skill Not Loading

**Symptom**: Claude doesn't use your skill

**Causes**:

- Invalid frontmatter YAML
- Missing `name` or `description`
- Plugin not installed correctly

**Solution**:

1. Validate frontmatter syntax
2. Re-install plugin
3. Restart Claude Code session

### MCP Server Connection Failed

**Symptom**: MCP tools unavailable

**Causes**:

- Server command fails to start
- Missing dependencies
- Invalid `.mcp.json` syntax

**Solution**:

```bash
# Test server manually
npx -y @your-org/mcp-server-your-service

# Check for errors in output
```

## Testing Checklist

Before distribution, verify:

- [ ] `han plugin validate .` passes
- [ ] All hooks run successfully
- [ ] Hooks skip when conditions aren't met
- [ ] Skills have valid frontmatter
- [ ] Commands execute correctly
- [ ] MCP servers start (for hashi plugins)
- [ ] Documentation is complete
- [ ] CHANGELOG is updated

## Next Steps

- [Distribution](/docs/plugin-development/distribution) - Share your plugin
