# Rspec

Comprehensive RSpec testing framework skills for Ruby projects with
behavior-driven development patterns.

## Skills

This plugin provides the following skills:

- **Rspec Advanced**
- **Rspec Fundamentals**
- **Rspec Mocking**

## Usage

Once enabled, Claude will automatically apply these skills when working with relevant code. The plugin provides context and expertise that Claude uses to:

- Write idiomatic code following best practices
- Suggest appropriate patterns and architectures
- Catch common mistakes and anti-patterns
- Provide framework-specific guidance

## Quality Hooks

This plugin includes hooks that ensure RSpec tests pass before
completing work. The hooks use `bushido-han` to support both
single-package and monorepo projects.

### Monorepo Support

The hooks automatically detect directories with `Gemfile` and run
tests in each:

```bash
npx -y @thebushidocollective/han hook run --fail-fast --dirs-with Gemfile -- bundle exec rspec
```

This ensures all Ruby packages in your monorepo pass tests before
work is marked complete.

## Installation

Install with npx (no installation required):

```bash
han plugin install jutsu-rspec
```

## License

Licensed under MIT -
see repository for details.
