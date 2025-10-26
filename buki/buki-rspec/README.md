# Buki Rspec

Comprehensive RSpec testing framework skills for Ruby projects with
behavior-driven development patterns.

## Skills

This plugin provides the following skills:

- **Rspec Advanced**
- **Rspec Fundamentals**
- **Rspec Mocking**

## Usage

Skills can be invoked using the Skill tool:

```javascript
Skill("buki-rspec:rspec-advanced")
```

Each skill provides specialized knowledge and patterns
for Rspec development.

## Quality Hooks

This plugin includes hooks that ensure RSpec tests pass before
completing work. The hooks use `bushido-han` to support both
single-package and monorepo projects.

### Monorepo Support

The hooks automatically detect directories with `Gemfile` and run
tests in each:

```bash
npx -y @thebushidocollective/han validate --fail-fast --dirs-with Gemfile -- bundle exec rspec
```

This ensures all Ruby packages in your monorepo pass tests before
work is marked complete.

## License

Licensed under MIT -
see repository for details.
