---
name: ameba-configuration
description: Use when configuring Ameba rules and settings for Crystal projects including .ameba.yml setup, rule management, severity levels, and code quality enforcement.
allowed-tools:
  - Bash
  - Read
---

# Ameba Configuration

Configure Ameba, the static code analysis tool for Crystal, to enforce consistent code style and catch code smells in your Crystal projects.

## Understanding Ameba

Ameba is a static code analysis tool for the Crystal programming language that:

- Enforces consistent Crystal code style
- Catches code smells and wrong code constructions
- Provides configurable rules organized into categories
- Supports inline disabling of rules
- Offers auto-correction for many issues
- Integrates seamlessly with Crystal development workflows

## Core Configuration File: .ameba.yml

### Generating Default Configuration

```bash
# Generate a new configuration file with all defaults
ameba --gen-config

# This creates .ameba.yml with all available rules and their default settings
```

### Basic Configuration Structure

```yaml
# .ameba.yml - Complete example configuration

# Global source configuration
Globs:
  - "**/*.cr"      # Include all Crystal files
  - "**/*.ecr"     # Include Embedded Crystal files
  - "!lib"         # Exclude dependencies

Excluded:
  - src/legacy/**  # Exclude legacy code
  - spec/fixtures/** # Exclude test fixtures

# Rule categories and individual rules
Lint/UnusedArgument:
  Enabled: true
  Severity: Warning

Style/RedundantReturn:
  Enabled: true
  Severity: Convention

Performance/AnyInsteadOfEmpty:
  Enabled: true
  Severity: Warning
```

## Source File Configuration

### Globs: Defining What to Analyze

```yaml
# Include specific patterns
Globs:
  - "**/*.cr"        # All Crystal source files
  - "**/*.ecr"       # All Embedded Crystal templates
  - "!lib/**"        # Exclude lib directory
  - "!vendor/**"     # Exclude vendor directory

# Common patterns
# - "src/**/*.cr"    # Only src directory
# - "spec/**/*.cr"   # Only spec directory
# - "!**/*_test.cr"  # Exclude test files
```

### Excluded: Fine-Grained Exclusions

```yaml
# Global exclusions (applied to all rules)
Excluded:
  - src/compiler/**      # Exclude specific directories
  - src/legacy/**
  - spec/fixtures/**
  - db/migrations/**     # Often excluded from style checks

# Real-world example
Globs:
  - "**/*.cr"
  - "!lib"

Excluded:
  - src/external/generated/**  # Generated code
  - src/legacy/**              # Legacy code being refactored
  - spec/support/fixtures/**   # Test data
```

### Source Configuration Examples

```yaml
# Example 1: Standard web application
Globs:
  - "src/**/*.cr"
  - "spec/**/*.cr"
  - "!lib"

Excluded:
  - src/assets/**
  - spec/fixtures/**

# Example 2: Library/Shard
Globs:
  - "src/**/*.cr"
  - "spec/**/*.cr"
  - "examples/**/*.cr"
  - "!lib"

Excluded:
  - spec/support/**

# Example 3: Monorepo
Globs:
  - "apps/**/src/**/*.cr"
  - "apps/**/spec/**/*.cr"
  - "packages/**/src/**/*.cr"
  - "!lib"
  - "!**/node_modules/**"

Excluded:
  - apps/legacy/**
```

## Rule Categories

### Lint Rules (Code Correctness)

Lint rules catch potential bugs and incorrect code:

```yaml
# Unused variables and arguments
Lint/UnusedArgument:
  Enabled: true
  Severity: Warning
  # Catches: def process(data, unused_param)

Lint/UselessAssign:
  Enabled: true
  Severity: Warning
  # Catches: x = 5; x = 10  # First assignment never used

# Shadowed variables
Lint/ShadowingOuterLocalVar:
  Enabled: true
  Severity: Warning
  # Catches: x = 1; proc { |x| x }  # x shadows outer x

# Unreachable code
Lint/UnreachableCode:
  Enabled: true
  Severity: Error
  # Catches: return x; do_something()  # Never executes

# Syntax issues
Lint/Syntax:
  Enabled: true
  Severity: Error
  # Catches syntax errors before compilation

# Empty blocks
Lint/EmptyBlock:
  Enabled: true
  Severity: Warning
  ExcludeEmptyBlocks: false
  # Catches: items.each { }

# Debugger statements
Lint/DebuggerStatement:
  Enabled: true
  Severity: Warning
  # Catches: debugger; pp value
```

### Style Rules (Code Conventions)

Style rules enforce Crystal code conventions:

```yaml
# Naming conventions
Style/ConstantNames:
  Enabled: true
  Severity: Convention
  # Enforces: CONSTANT_NAME not Constant_Name

Style/MethodNames:
  Enabled: true
  Severity: Convention
  # Enforces: method_name not methodName

Style/TypeNames:
  Enabled: true
  Severity: Convention
  # Enforces: ClassName not Class_Name

# Predicate methods
Style/PredicateName:
  Enabled: true
  Severity: Convention
  # Enforces: empty? not is_empty

# Redundant code
Style/RedundantReturn:
  Enabled: true
  Severity: Convention
  AllowMultipleReturnValues: true
  # Catches: def foo; return 42; end
  # Prefers: def foo; 42; end

Style/RedundantBegin:
  Enabled: true
  Severity: Convention
  # Catches: def foo; begin; 42; end; end
  # Prefers: def foo; 42; end

# Large numbers
Style/LargeNumbers:
  Enabled: true
  Severity: Convention
  IntMinDigits: 5
  # Enforces: 100_000 not 100000

# Parentheses
Style/ParenthesesAroundCondition:
  Enabled: true
  Severity: Convention
  # Enforces: if x > 5 not if (x > 5)

# String literals
Style/StringLiterals:
  Enabled: true
  Severity: Convention
  # Catches inconsistent quote usage

# Variable names
Style/VariableNames:
  Enabled: true
  Severity: Convention
  # Enforces: snake_case not camelCase
```

### Performance Rules

Performance rules identify inefficient code patterns:

```yaml
# Inefficient any? usage
Performance/AnyInsteadOfEmpty:
  Enabled: true
  Severity: Warning
  FilterFirstNegativeCondition: true
  # Catches: array.any?
  # Prefers: !array.empty?

# Size after filter
Performance/SizeAfterFilter:
  Enabled: true
  Severity: Warning
  FilterNames: [select, reject]
  # Catches: items.select(&.active?).size
  # Prefers: items.count(&.active?)

# Compact after map
Performance/CompactAfterMap:
  Enabled: true
  Severity: Warning
  # Catches: items.map(&.value?).compact
  # Prefers: items.compact_map(&.value?)

# Flatten after map
Performance/FlattenAfterMap:
  Enabled: true
  Severity: Warning
  # Catches: items.map(&.children).flatten
  # Prefers: items.flat_map(&.children)
```

## Rule Configuration Options

### Per-Rule Configuration

```yaml
# Enable/disable individual rules
Style/LargeNumbers:
  Enabled: true  # or false to disable

# Set severity levels
Style/RedundantReturn:
  Enabled: true
  Severity: Warning  # Error, Warning, Convention

# Configure rule-specific options
Style/LargeNumbers:
  Enabled: true
  Severity: Convention
  IntMinDigits: 5    # Minimum digits before requiring underscores

Lint/UnusedArgument:
  Enabled: true
  IgnoreTypeDeclarations: false
  IgnoreParameterNames: []  # Parameter names to ignore

# Exclude files from specific rules
Style/RedundantBegin:
  Enabled: true
  Excluded:
    - src/server/processor.cr
    - src/server/api.cr
```

### Advanced Rule Configuration Examples

```yaml
# Custom severity levels
Lint/UselessAssign:
  Enabled: true
  Severity: Error     # Make this an error, not warning

Style/RedundantReturn:
  Enabled: true
  Severity: Convention
  AllowMultipleReturnValues: true  # Allow: return x, y

# Ignore specific parameter patterns
Lint/UnusedArgument:
  Enabled: true
  IgnoreParameterNames:
    - "_*"       # Ignore params starting with underscore
    - "unused_*" # Ignore params prefixed with unused_

# Configure numeric formatting
Style/LargeNumbers:
  Enabled: true
  IntMinDigits: 5    # 10000 requires underscores
  # 1000 is fine, 10000 should be 10_000

# Performance tuning
Performance/SizeAfterFilter:
  Enabled: true
  FilterNames:
    - select
    - reject
    - filter
```

## Severity Levels

### Understanding Severity

```yaml
# Error: Must be fixed (blocks CI typically)
Lint/Syntax:
  Severity: Error

# Warning: Should be fixed (important issues)
Lint/UnusedArgument:
  Severity: Warning

# Convention: Style preference (less critical)
Style/RedundantReturn:
  Severity: Convention
```

### Severity Configuration Strategy

```yaml
# Conservative approach (CI-friendly)
# Only errors block builds
Lint/Syntax:
  Severity: Error

Lint/UnreachableCode:
  Severity: Error

Style/RedundantReturn:
  Severity: Warning

Style/LargeNumbers:
  Severity: Convention

# Strict approach (enforce everything)
# All issues treated as errors
Lint/UnusedArgument:
  Severity: Error

Style/RedundantReturn:
  Severity: Error

Style/VariableNames:
  Severity: Error

# Progressive approach (gradually increase strictness)
# Start with warnings, move to errors over time
Lint/UselessAssign:
  Severity: Warning  # Will become Error after cleanup

Style/RedundantBegin:
  Severity: Convention  # Will become Warning after team adapts
```

## Inline Rule Control

### Disabling Rules in Code

```crystal
# Disable single rule for one line
time = Time.epoch(1483859302) # ameba:disable Style/LargeNumbers

# Disable multiple rules for one line
result = calculate() # ameba:disable Style/RedundantReturn, Lint/UselessAssign

# Disable rule categories
# ameba:disable Style, Lint
def legacy_method
  # Old code with known issues
end
# ameba:enable Style, Lint

# Disable specific rule for block
# ameba:disable Style/RedundantBegin
def process
  begin
    perform_operation
  rescue
    handle_error
  end
end
# ameba:enable Style/RedundantBegin

# Common patterns
class LegacyService
  # ameba:disable Lint/UnusedArgument
  def process(data, context)
    # Only using data for now
    data.process
  end
  # ameba:enable Lint/UnusedArgument
end
```

### Inline Disable Best Practices

```crystal
# GOOD - Specific and temporary
def parse_timestamp(value)
  Time.epoch(1483859302) # ameba:disable Style/LargeNumbers
end

# GOOD - With explanation
# This API requires exact numeric format
# ameba:disable Style/LargeNumbers
LEGACY_TIMESTAMP = 1483859302
# ameba:enable Style/LargeNumbers

# BAD - Too broad
# ameba:disable Style
# Disables all style rules - too permissive
def messy_method
  # ...
end

# BAD - Never re-enabled
# ameba:disable Lint/UselessAssign
# Disables for rest of file

# GOOD - Scoped to minimum area
def external_api_call
  # ameba:disable Style/VariableNames
  responseData = call_api()  # External API uses camelCase
  # ameba:enable Style/VariableNames

  response_data = responseData  # Convert to Crystal convention
end
```

## Complete Configuration Examples

### Minimal Configuration (Permissive)

```yaml
# .ameba.yml - Minimal setup for new projects
Globs:
  - "**/*.cr"
  - "!lib"

# Only enable critical rules
Lint/Syntax:
  Enabled: true
  Severity: Error

Lint/UnreachableCode:
  Enabled: true
  Severity: Error
```

### Standard Configuration (Balanced)

```yaml
# .ameba.yml - Standard configuration for most projects
Globs:
  - "**/*.cr"
  - "**/*.ecr"
  - "!lib"

Excluded:
  - spec/fixtures/**

# Lint rules (errors and warnings)
Lint/Syntax:
  Enabled: true
  Severity: Error

Lint/UnusedArgument:
  Enabled: true
  Severity: Warning

Lint/UselessAssign:
  Enabled: true
  Severity: Warning

Lint/UnreachableCode:
  Enabled: true
  Severity: Error

# Style rules (conventions)
Style/RedundantReturn:
  Enabled: true
  Severity: Convention

Style/RedundantBegin:
  Enabled: true
  Severity: Convention

Style/LargeNumbers:
  Enabled: true
  Severity: Convention
  IntMinDigits: 5

Style/VariableNames:
  Enabled: true
  Severity: Warning

# Performance rules
Performance/AnyInsteadOfEmpty:
  Enabled: true
  Severity: Warning

Performance/SizeAfterFilter:
  Enabled: true
  Severity: Warning
```

### Strict Configuration (Comprehensive)

```yaml
# .ameba.yml - Strict configuration for production code
Globs:
  - "src/**/*.cr"
  - "spec/**/*.cr"
  - "!lib"

Excluded:
  - spec/fixtures/**
  - spec/support/mocks/**

# All lint rules enabled as errors
Lint/Syntax:
  Enabled: true
  Severity: Error

Lint/UnusedArgument:
  Enabled: true
  Severity: Error

Lint/UselessAssign:
  Enabled: true
  Severity: Error

Lint/UnreachableCode:
  Enabled: true
  Severity: Error

Lint/ShadowingOuterLocalVar:
  Enabled: true
  Severity: Error

Lint/DebuggerStatement:
  Enabled: true
  Severity: Error

# Style rules as warnings or errors
Style/RedundantReturn:
  Enabled: true
  Severity: Error

Style/RedundantBegin:
  Enabled: true
  Severity: Error

Style/LargeNumbers:
  Enabled: true
  Severity: Error
  IntMinDigits: 4

Style/VariableNames:
  Enabled: true
  Severity: Error

Style/MethodNames:
  Enabled: true
  Severity: Error

Style/ConstantNames:
  Enabled: true
  Severity: Error

Style/PredicateName:
  Enabled: true
  Severity: Warning

# Performance rules as warnings
Performance/AnyInsteadOfEmpty:
  Enabled: true
  Severity: Warning

Performance/SizeAfterFilter:
  Enabled: true
  Severity: Warning

Performance/CompactAfterMap:
  Enabled: true
  Severity: Warning

Performance/FlattenAfterMap:
  Enabled: true
  Severity: Warning
```

## When to Use This Skill

Use the ameba-configuration skill when:

- Setting up Ameba for a new Crystal project
- Configuring code quality standards for a team
- Customizing rule severity levels for CI/CD
- Excluding legacy code or generated files from analysis
- Troubleshooting rule conflicts or false positives
- Migrating from one Ameba version to another
- Establishing project-specific coding standards
- Balancing code quality with development velocity
- Integrating Ameba into existing Crystal projects
- Creating configuration templates for multiple projects

## Best Practices

1. **Start with generated config** - Run `ameba --gen-config` to see all available rules and their defaults
2. **Use version control** - Commit `.ameba.yml` so team members share the same configuration
3. **Enable incrementally** - Start permissive, gradually enable more rules as team adapts
4. **Set appropriate severities** - Use Error for blocking issues, Warning for important, Convention for style
5. **Document exceptions** - Add comments explaining why specific rules are disabled or configured differently
6. **Scope exclusions narrowly** - Exclude specific files/directories rather than disabling rules globally
7. **Use inline disables sparingly** - Prefer fixing issues over disabling rules; when necessary, be specific
8. **Review generated config** - Don't blindly use default config; review and customize for your project
9. **Separate concerns** - Use different severity levels for different types of issues (bugs vs style)
10. **Test configuration changes** - Run `ameba` locally before committing configuration changes
11. **Keep config maintainable** - Group related rules together and use comments to explain sections
12. **Align with team standards** - Configuration should reflect team consensus, not individual preferences
13. **Update regularly** - Review and update configuration when upgrading Ameba versions
14. **Use rule-specific exclusions** - Exclude files from specific rules rather than globally when possible
15. **Monitor false positives** - Adjust rules that generate too many false positives for your codebase

## Common Pitfalls

1. **Too strict initially** - Enabling all rules at maximum severity in existing projects creates overwhelming technical debt
2. **Too permissive permanently** - Never tightening rules means missing valuable code quality improvements
3. **Excluding too broadly** - Using `Excluded: ["**/*"]` defeats the purpose of static analysis
4. **Inconsistent severity** - Mixing up severity levels (making style issues errors, making bugs conventions)
5. **Not using version control** - Team members using different configurations causes confusion
6. **Ignoring upgrade guides** - New Ameba versions may change rule names or behaviors
7. **Disabling without understanding** - Turning off rules that flag legitimate issues
8. **Overusing inline disables** - Littering code with `ameba:disable` comments instead of fixing issues
9. **Not excluding generated code** - Wasting time analyzing auto-generated files
10. **Forgetting about ECR files** - Not including `**/*.ecr` in Globs for web applications
11. **Conflicting with formatter** - Enabling rules that conflict with `crystal tool format`
12. **Missing test files** - Not including `spec/**/*.cr` in Globs
13. **Global disables in code** - Using `ameba:disable` at file level without re-enabling
14. **Not testing CI integration** - Configuration works locally but fails in CI environment
15. **Ignoring performance impact** - Enabling every rule without considering analysis time on large codebases

## Resources

- [Ameba GitHub Repository](https://github.com/crystal-ameba/ameba)
- [Ameba Official Documentation](https://crystal-ameba.github.io/ameba/)
- [Writing Custom Rules Tutorial](https://crystal-ameba.github.io/2019/07/22/how-to-write-extension/)
- [Ameba Internals Guide](https://crystal-ameba.github.io/2019/09/03/internals/)
- [Crystal Language Documentation](https://crystal-lang.org/docs/)
