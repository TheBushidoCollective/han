---
name: validation
summary: Configuration validation and schema enforcement
---

# Validation System

Configuration validation, schema enforcement, and quality checks for plugins and user configurations.

## Overview

The validation system ensures that plugin configurations (han-plugin.yml) adhere to expected schemas and contain valid data. It provides clear error messages to help users fix configuration issues before runtime.

## Architecture

### Validation Layers

```
┌─────────────────────────────────┐
│   Plugin Config Validation      │
│   (han-plugin.yml schema)       │
└───────────┬─────────────────────┘
            │
┌───────────┴─────────────────────┐
│   Merged Config Validation      │
│   (runtime consistency checks)  │
└─────────────────────────────────┘
```

### Validation Trigger Points

1. **Plugin Load Time** - When CLI reads plugin configuration
2. **Build Time** - During CI/CD (Claude Code CLI plugin validate)
3. **Runtime** - Before hook execution

## API / Interface

### Config Validator

**File**: `packages/han/lib/config/config-validator.ts`

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
```

### Plugin Config Schema (han-plugin.yml)

```typescript
interface HanConfig {
  hooks: Record<string, HookDefinition>;
  skills?: string[];
  mcp?: McpServerConfig;
}

interface HookDefinition {
  command: string;              // Required: shell command
  dirsWith?: string[];          // Optional: marker files
  dirTest?: string;             // Optional: custom directory filter
  ifChanged?: string[];         // Optional: glob patterns
  idleTimeout?: number;         // Optional: timeout in milliseconds
  description?: string;         // Optional: hook description
  beforeAll?: string;           // Optional: setup script
}
```

**Validation Rules**:

1. **Required Fields**:
   - `hooks` object must exist
   - Each hook must have `command` property

2. **Type Checks**:
   - `command` must be string
   - `dirsWith` must be string array
   - `dirTest` must be string
   - `ifChanged` must be string array
   - `idleTimeout` must be number

3. **Value Constraints**:
   - `command` must be non-empty
   - `idleTimeout` must be positive integer
   - Arrays must not be empty if present

**Example Valid Config**:

```yaml
hooks:
  lint:
    command: npm run lint
    dirsWith:
      - package.json
    ifChanged:
      - "**/*.{ts,tsx,js,jsx}"
    idleTimeout: 5000
```

**Example Invalid Config**:

```yaml
hooks:
  lint:
    # Missing required "command" field
    dirsWith:
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

### Build-Time Validation (Claude Code CLI)

**When**: CI/CD and pre-commit hooks

**Workflow**: `.github/workflows/claudelint.yml`

```bash
claude plugin validate .
```

**Checks**:

- All `plugin.json` files are valid JSON
- All required fields present
- Skills/commands/agents directories exist if referenced
- Hooks follow expected structure

**Exit Code**:

- 0 = All validations passed
- 1 = Validation errors found

**Output**:

```
Validating typescript/...
  ✓ Valid plugin.json
  ✓ Skills exist
  ✓ Hooks structure valid

Validating biome/...
  ✗ Invalid: hooks/hooks.json has syntax error

Validation failed: 1 error found
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

❌ hooks.typecheck.idleTimeout: Expected number, got string
   Change idleTimeout: "5000" to idleTimeout: 5000

❌ hooks.unknown.dirsWith: Array must not be empty
   Provide at least one marker file, e.g., dirsWith: [package.json]
```

### Debug Mode

Enable verbose validation errors:

```bash
HAN_DEBUG=1 han hook run plugin-name hook-name
```

**Output**:

```
[DEBUG] Loading han-plugin.yml from typescript/
[DEBUG] Validating plugin config...
[DEBUG] ✓ Root object is valid
[DEBUG] ✓ hooks object exists
[DEBUG] ✓ Hook 'lint' has required 'command'
[DEBUG] ✓ Hook 'lint' has valid 'dirsWith' array
[DEBUG] Validation passed
```

## Files

### Implementation

- `packages/han/lib/config/config-validator.ts` - Core validation logic
- `packages/han/lib/config/han-settings.ts` - Config loading

### Testing

- `packages/han/test/config-validator.test.ts` - Unit tests for validation

### CI/CD

- `.github/workflows/claudelint.yml` - Build-time validation

### Schemas

- `packages/han/schemas/han-config-override.schema.json` - JSON schema for user overrides

## Related Systems

- [Hook System](./hook-system.md) - Consumes validated configuration
- [Plugin Directory](./plugin-directory.md) - Files being validated
- [Build & Deployment](./build-deployment.md) - CI/CD validation checks