# Jutsu (術) - Techniques

This directory contains all **jutsu** plugins - specialized skills and
techniques for specific programming languages, frameworks, testing tools,
and linting frameworks.

## What is Jutsu?

In the Bushido tradition, **jutsu** (術) means "technique" or "art" - the methods
and practices a practitioner masters. In software development, jutsu plugins
provide deep expertise in specific technologies, languages, and tools.

## Categories

### Programming Languages

Master the fundamentals and advanced patterns of programming languages:

- **C, C++, C#** - Systems programming and memory management
- **Go, Rust** - Modern systems languages with concurrency
- **Java, Kotlin, Scala** - JVM ecosystem languages
- **JavaScript, TypeScript** - Web development foundations
- **Python** - Data science and general-purpose programming
- **Ruby, PHP** - Web application languages
- **Elixir, Erlang, Gleam** - BEAM ecosystem languages
- **Swift, Objective-C** - Apple platform development
- **Lua, Nim, Crystal** - Specialized scripting and systems languages

### Web Frameworks

Build modern web applications with framework-specific patterns:

- **React, Vue, Angular** - Frontend frameworks
- **Next.js** - React meta-framework
- **Django, FastAPI** - Python web frameworks
- **NestJS** - TypeScript/Node.js framework
- **Rails** - Ruby web framework

### GraphQL

GraphQL API development and client libraries:

- **GraphQL** - Schema design and resolvers
- **Apollo GraphQL** - Client and server implementation
- **Relay** - React GraphQL framework

### Testing Frameworks

Write comprehensive tests with framework-specific patterns:

- **Jest, Vitest, Mocha** - JavaScript testing
- **Pytest** - Python testing
- **RSpec** - Ruby testing
- **JUnit, TestNG** - Java testing
- **Cypress, Playwright** - End-to-end testing

### Linting & Formatting

Enforce code quality and style standards:

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **Pylint** - Python linting
- **RuboCop** - Ruby linting
- **Clippy** - Rust linting
- **Checkstyle** - Java linting

### Development Tools

Advanced development patterns and practices:

- **Monorepo** - Multi-package repository management

## How to Use Jutsu

Each jutsu plugin contains one or more **skills** that can be invoked
during development. Skills are loaded on-demand when needed.

Example usage:

```bash
# TypeScript type system mastery
/skill jutsu-typescript:typescript-type-system

# React hooks patterns
/skill jutsu-react:react-hooks-patterns

# FastAPI dependency injection
/skill jutsu-fastapi:fastapi-dependency-injection
```

## Plugin Structure

Each jutsu plugin follows this structure:

```text
jutsu-{technology}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── skills/
│   └── {skill-name}/
│       └── SKILL.md         # Skill implementation
└── README.md                # Plugin documentation
```

## Validation Hooks

Jutsu plugins include validation hooks that run automatically during your Claude Code session:

- **Stop**: Validate code quality before completing work
- **SubagentStop**: Validate after subagent tasks complete

### Hook Configuration

Each jutsu plugin has a `han-plugin.yml` that defines its hooks:

```yaml
hooks:
  lint:
    command: "npx -y eslint --fix ."
    dirs_with:
      - eslint.config.js
      - .eslintrc.js
    if_changed:
      - "**/*.{js,jsx,ts,tsx}"
```

- **command**: The validation command to run
- **dirs_with**: Only run in directories containing these files
- **if_changed**: Glob patterns for change detection (enables caching)

### Smart Caching

Hooks use intelligent caching to avoid redundant runs:

1. File hashes are stored in `~/.claude/projects/{project}/han/`
2. On each hook run with `--cache`, files matching `ifChanged` patterns are checked
3. If no files have changed since the last successful run, the hook is skipped
4. Cache persists across Claude Code sessions

This means your linter won't run if you haven't modified any source files, and your tests won't run if nothing has changed.

### Customizing Hooks

You can override hook behavior per-directory with a `han-config.yml` file:

```yaml
jutsu-eslint:
  lint:
    enabled: false  # Disable this hook in this directory
    # Or override the command:
    # command: "npm run lint:custom"
    # Or override which files trigger the hook:
    # if_changed:
    #   - "src/**/*.ts"
    #   - "!src/**/*.test.ts"
```

Available override options:

- **enabled**: Set to `false` to disable the hook in this directory
- **command**: Override the command to run
- **if_changed**: Additional glob patterns for change detection (merged with plugin defaults)

## Quality Standards

All jutsu plugins enforce quality through:

- Comprehensive skill documentation (400+ lines)
- 10+ code examples per skill
- Best practices and common pitfalls
- Pass claudelint and markdownlint validation

## License

MIT License - see individual plugin directories for details.
