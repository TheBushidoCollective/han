# Buki (武器) - Weapons

This directory contains all **buki** plugins - specialized skills and
techniques for specific programming languages, frameworks, testing tools,
and linting frameworks.

## What is Buki?

In the Bushido tradition, **buki** (武器) means "weapon" - the tools and
techniques a warrior masters. In software development, buki plugins
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

## How to Use Buki

Each buki plugin contains one or more **skills** that can be invoked
during development. Skills are loaded on-demand when needed.

Example usage:

```bash
# TypeScript type system mastery
/skill buki-typescript:typescript-type-system

# React hooks patterns
/skill buki-react:react-hooks-patterns

# FastAPI dependency injection
/skill buki-fastapi:fastapi-dependency-injection
```

## Plugin Structure

Each buki plugin follows this structure:

```text
buki-{technology}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── skills/
│   └── {skill-name}/
│       └── SKILL.md         # Skill implementation
└── README.md                # Plugin documentation
```

## Quality Standards

All buki plugins enforce quality through:

- Comprehensive skill documentation (400+ lines)
- 10+ code examples per skill
- Best practices and common pitfalls
- Pass claudelint and markdownlint validation

## License

MIT License - see individual plugin directories for details.
