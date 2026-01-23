# Plugin Installation UX

## Problem

Users may install the han Claude Code plugin without having the han CLI binary installed. This creates a poor UX where hooks fail with cryptic "command not found" errors.

## Solution

Three-tier fallback mechanism to ensure smooth installation:

### Tier 1: Setup Hook (Auto-Install)

When the plugin is first installed, the `Setup` hook runs automatically:

1. **Checks if han is installed** (in PATH or `~/.claude/bin/han`)
2. **Auto-installs if missing** via `curl -fsSL https://han.guru/install.sh | bash`
3. **Provides PATH setup instructions** if successful
4. **Shows manual installation options** if auto-install fails

**Hook definition** (core/han-plugin.yml):

```yaml
hooks:
  setup:
    event: Setup
    command: bash "${CLAUDE_PLUGIN_ROOT}/hooks/setup.sh"
    description: Ensure han binary is installed and available
```

**Setup script** (core/hooks/setup.sh):

- Detects han in PATH or ~/.claude/bin
- Auto-installs on `--init` or `--init-only` flags
- Provides clear installation instructions
- Exits successfully (doesn't block plugin installation)

### Tier 2: Graceful Degradation

If setup didn't install han and hooks run:

1. **Hooks that call han fail** with exit code 127 (command not found)
2. **Hook orchestrator detects** the failure
3. **Shows helpful error message** instead of raw bash error

**Error message format**:

```
✗ Han binary not found

The han plugin requires the han CLI, but it's not installed or not in PATH.

Quick Fix:

  Install via curl (recommended):
    curl -fsSL https://han.guru/install.sh | bash

  Or via Homebrew:
    brew install thebushidocollective/tap/han

After installing, restart your Claude Code session.
```

### Tier 3: Documentation

Clear documentation in multiple places:

1. **Plugin README** - Installation requirements upfront
2. **han.guru website** - Installation guide
3. **Error messages** - Link to docs for more help

## User Flows

### Flow 1: Fresh Install (Happy Path)

```
User enables han plugin in Claude Code
    ↓
Setup hook runs (--init)
    ↓
Detects han not installed
    ↓
Auto-installs to ~/.claude/bin/han
    ↓
Shows PATH setup instructions
    ↓
User adds to shell profile (optional)
    ↓
✓ Hooks work immediately
```

### Flow 2: Fresh Install (Auto-Install Fails)

```
User enables han plugin
    ↓
Setup hook runs (--init)
    ↓
Auto-install fails (network issue, permissions, etc.)
    ↓
Shows manual installation options
    ↓
User installs via curl or brew
    ↓
Restarts Claude Code session
    ↓
✓ Hooks work
```

### Flow 3: Existing User (Han Already Installed)

```
User enables han plugin
    ↓
Setup hook runs (--init)
    ↓
Detects han already in PATH
    ↓
Shows version info
    ↓
✓ Done - no action needed
```

### Flow 4: User Ignores Setup

```
User enables plugin, ignores setup messages
    ↓
Hook tries to run
    ↓
Detects han command not found
    ↓
Shows helpful error with install instructions
    ↓
User installs han
    ↓
Next hook run succeeds
```

## Benefits

1. **Zero-friction for most users** - Auto-install works in most cases
2. **Clear guidance when it doesn't** - No cryptic errors
3. **Multiple installation methods** - Users can choose (curl, brew, manual)
4. **Doesn't block plugin installation** - Setup exits 0 even if han not installed
5. **Works without PATH modification** - Han in `~/.claude/bin` is found

## Files

- `core/hooks/setup.sh` - Setup hook script with auto-install
- `core/hooks/han-not-found-helper.sh` - Helper error message
- `core/han-plugin.yml` - Setup hook registration

## Testing

To test the UX:

1. **Test fresh install**:
   ```bash
   # Remove han
   rm ~/.claude/bin/han
   rm $(which han)

   # Enable plugin in Claude Code
   # Setup hook should auto-install
   ```

2. **Test manual install flow**:
   ```bash
   # Block auto-install (simulate failure)
   export HAN_SKIP_AUTO_INSTALL=1

   # Enable plugin
   # Should show manual install options
   ```

3. **Test with han already installed**:
   ```bash
   # Install han first
   curl -fsSL https://han.guru/install.sh | bash

   # Enable plugin
   # Should detect and skip install
   ```
