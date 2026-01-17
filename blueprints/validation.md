---
name: validation
summary: Configuration validation and schema enforcement
---

# Validation System

Configuration validation, schema enforcement, and quality checks for plugins and user configurations.

## Overview

The validation system ensures that plugin configurations (han-plugin.yml) and user overrides (han-config.yml) adhere to expected schemas and contain valid data. It provides clear error messages to help users fix configuration issues before runtime.

## Architecture

### Validation Layers

```
┌─────────────────────────────────┐
│   Plugin Config Validation      │
│   (han-plugin.yml schema)       │
└───────────┬─────────────────────┘
            │
┌───────────┴─────────────────────┐
│   User Override Validation      │
│   (han-config.yml schema)       │
└───────────┬─────────────────────┘
            │
┌───────────┴─────────────────────┐
│   Merged Config Validation      │
│   (runtime consistency checks)  │
└─────────────────────────────────┘
```

### Validation Trigger Points

1. **Plugin Load Time** - When CLI reads plugin configuration
2. **User Override Load** - When user config file is present
3. **Hook Execution** - Before running validation commands
4. **Build Time** - During CI/CD (claudelint)

## API / Interface

### Config Validator

**File**: `packages/han/lib/config-validator.ts`

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  path: string;      // JSON path to error (e.g., "hooks.lint.command")
  message: string;   // Human-readable error description
}

function validatePluginConfig(config: unknown): ValidationResult;
function validateUserConfig(config: unknown): ValidationResult;
```

### Plugin Config Schema (han-plugin.yml)

```typescript
interface HanConfig {
  hooks: Record<string, HookDefinition>;
}

interface HookDefinition {
  command: string;              // Required: shell command
  dirs_with?: string[];         // Optional: marker files
  dir_test?: string;            // Optional: custom directory filter
  if_changed?: string[];        // Optional: glob patterns
  idle_timeout?: number;        // Optional: timeout in milliseconds
}
```

**Validation Rules**:

1. **Required Fields**:
   - `hooks` object must exist
   - Each hook must have `command` property

2. **Type Checks**:
   - `command` must be string
   - `dirs_with` must be string array
   - `dir_test` must be string
   - `if_changed` must be string array
   - `idle_timeout` must be number

3. **Value Constraints**:
   - `command` must be non-empty
   - `idle_timeout` must be positive integer
   - Arrays must not be empty if present

**Example Valid Config**:

```yaml
hooks:
  lint:
    command: npm run lint
    dirs_with:
      - package.json
    if_changed:
      - "**/*.{ts,tsx,js,jsx}"
    idle_timeout: 5000
```

**Example Invalid Config**:

```yaml
hooks:
  lint:
    # Missing required "command" field
    dirs_with:
      - package.json
```

**Validation Error**:

```typescript
{
  valid: false,
  errors: [{
    path: "hooks.lint.command",
    message: "Required field 'command' is missing"
  }]
}
```

### User Override Schema (han-config.yml)

```typescript
interface UserConfig {
  plugins?: Record<string, PluginOverride>;
}

interface PluginOverride {
  enabled?: boolean;                        // Enable/disable entire plugin
  hooks?: Record<string, HookOverride>;     // Per-hook overrides
}

interface HookOverride {
  enabled?: boolean;            // Enable/disable specific hook
  command?: string;             // Override command
  if_changed?: string[];        // Add/override patterns
  idle_timeout?: number;        // Override timeout
}
```

**Validation Rules**:

1. **Plugin Name** must match installed plugin
2. **Hook Name** must exist in plugin's han-plugin.yml
3. **Override Fields** must match allowed override types
4. **Type Checks** same as plugin config

**Example Valid User Config**:

```yaml
plugins:
  jutsu-typescript:
    enabled: true
    hooks:
      lint:
        enabled: false
      typecheck:
        command: "npx -y --package typescript tsc --strict"
        idle_timeout: 10000
```

**Example Invalid User Config**:

```yaml
plugins:
  nonexistent-plugin:  # Plugin not installed
    hooks:
      lint:
        enabled: true
```

**Validation Error**:

```typescript
{
  valid: false,
  errors: [{
    path: "plugins.nonexistent-plugin",
    message: "Plugin 'nonexistent-plugin' is not installed"
  }]
}
```

## Behavior

### Plugin Config Validation

**When**: Loading plugin at runtime

**Process**:

1. Read `han-plugin.yml` from plugin directory
2. Parse YAML
3. Validate against schema
4. If invalid, log errors and skip plugin
5. If valid, proceed to merge with user config

**Error Handling**:

```typescript
try {
  const config = YAML.parse(fs.readFileSync('han-plugin.yml', 'utf8'));
  const result = validatePluginConfig(config);

  if (!result.valid) {
    console.error(`Invalid han-plugin.yml in ${pluginName}:`);
    result.errors.forEach(err => {
      console.error(`  ${err.path}: ${err.message}`);
    });
    return null;  // Skip plugin
  }

  return config;
} catch (error) {
  console.error(`Failed to load han-plugin.yml: ${error.message}`);
  return null;
}
```

### User Override Validation

**When**: Loading user config from `han-config.yml`

**Process**:

1. Check if `han-config.yml` exists in project root
2. Parse YAML
3. Validate plugin names against installed plugins
4. Validate hook names against plugin configs
5. Validate override values
6. If invalid, log errors and ignore overrides
7. If valid, merge with plugin configs

**Merge Strategy**:

```typescript
function mergeConfigs(pluginConfig: HanConfig, userOverrides: UserConfig): HanConfig {
  const merged = { ...pluginConfig };

  const pluginOverride = userOverrides.plugins?.[pluginName];
  if (!pluginOverride) return merged;

  // Plugin-level enable/disable
  if (pluginOverride.enabled === false) {
    return { hooks: {} };  // Disable all hooks
  }

  // Hook-level overrides
  for (const [hookName, hookOverride] of Object.entries(pluginOverride.hooks || {})) {
    if (hookOverride.enabled === false) {
      delete merged.hooks[hookName];  // Disable specific hook
      continue;
    }

    merged.hooks[hookName] = {
      ...merged.hooks[hookName],
      ...(hookOverride.command && { command: hookOverride.command }),
      ...(hookOverride.if_changed && {
        if_changed: [...merged.hooks[hookName].if_changed || [], ...hookOverride.if_changed]
      }),
      ...(hookOverride.idle_timeout && { idle_timeout: hookOverride.idle_timeout })
    };
  }

  return merged;
}
```

### Runtime Validation

**When**: Before executing hook

**Checks**:

1. Command is executable (exists in PATH)
2. Directory markers exist if `dirs_with` specified
3. Glob patterns are valid syntax
4. Timeout is reasonable (not too short)

**Example**:

```typescript
async function validateBeforeExecution(hook: HookDefinition): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Check command exists
  const commandName = hook.command.split(' ')[0];
  if (!await commandExists(commandName)) {
    errors.push({
      path: 'command',
      message: `Command '${commandName}' not found in PATH`
    });
  }

  // Validate glob patterns
  if (hook.if_changed) {
    for (const pattern of hook.if_changed) {
      try {
        micromatch.makeRe(pattern);
      } catch (err) {
        errors.push({
          path: 'if_changed',
          message: `Invalid glob pattern: '${pattern}'`
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Build-Time Validation (claudelint)

**When**: CI/CD and pre-commit hooks

**Workflow**: `.github/workflows/claudelint.yml`

```bash
uvx claudelint . --strict
```

**Checks**:

- All `han-plugin.yml` files are valid YAML
- All required fields present
- No unknown fields
- Type correctness
- Value constraints

**Exit Code**:

- 0 = All validations passed
- 1 = Validation errors found

**Output**:

```
Validating jutsu-typescript/han-plugin.yml...
  ✓ Valid YAML
  ✓ Required fields present
  ✓ Type checks passed
  ✓ Value constraints satisfied

Validating jutsu-biome/han-plugin.yml...
  ✗ Invalid: hooks.format.idle_timeout must be a number
  ✗ Invalid: hooks.lint.command is required

Validation failed: 2 errors found
```

## Error Messages

### User-Friendly Errors

**Design Principles**:

1. Clear path to error (JSON path notation)
2. Explain what's wrong
3. Suggest how to fix

**Examples**:

```
❌ hooks.lint.command: Required field 'command' is missing
   Add a "command" field with the validation command to run.
   Example: command: npm run lint

❌ hooks.typecheck.idle_timeout: Expected number, got string
   Change idle_timeout: "5000" to idle_timeout: 5000

❌ hooks.unknown.dirs_with: Array must not be empty
   Provide at least one marker file, e.g., dirs_with: [package.json]

❌ plugins.nonexistent-plugin: Plugin 'nonexistent-plugin' is not installed
   Check installed plugins with: han plugin list
   Install with: han plugin install nonexistent-plugin
```

### Debug Mode

Enable verbose validation errors:

```bash
HAN_DEBUG=1 han hook run plugin-name hook-name
```

**Output**:

```
[DEBUG] Loading han-plugin.yml from jutsu-typescript/
[DEBUG] Validating plugin config...
[DEBUG] ✓ Root object is valid
[DEBUG] ✓ hooks object exists
[DEBUG] ✓ Hook 'lint' has required 'command'
[DEBUG] ✓ Hook 'lint' has valid 'dirs_with' array
[DEBUG] ✓ Hook 'typecheck' has required 'command'
[DEBUG] Validation passed
```

## Files

### Implementation

- `packages/han/lib/config-validator.ts` - Core validation logic
- `packages/han/lib/hook-config.ts` - Config loading and merging

### Testing

- `packages/han/test/config-validator.test.ts` - Unit tests for validation

### CI/CD

- `.github/workflows/claudelint.yml` - Build-time validation

### Schemas

- `packages/han/schemas/han-plugin.schema.json` - YAML schema (if formalized)

## Related Systems

- [Hook System](./hook-system.md) - Consumes validated configuration
- [Plugin Directory](./plugin-directory.md) - Files being validated
- [Build & Deployment](./build-deployment.md) - CI/CD validation checks
