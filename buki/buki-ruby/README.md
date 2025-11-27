# Buki: Ruby

Advanced Ruby programming skills covering object-oriented programming, metaprogramming, blocks, closures, gems, and the standard library.

## What This Buki Provides

### Validation Hooks

- **Ruby Syntax Validation**: Runs `ruby -c` to check syntax before completion
- **Automatic Quality Checks**: Validates Ruby code when Claude Code or agents finish work

### Skills

This buki provides the following skills:

- **ruby-oop**: Object-oriented programming including classes, modules, inheritance, mixins, and method visibility
- **ruby-blocks-procs-lambdas**: Blocks, procs, lambdas, closures, and functional programming patterns
- **ruby-metaprogramming**: Dynamic method definition, method_missing, reflection, DSLs, and runtime code generation
- **ruby-gems-bundler**: Gem management, Bundler, dependency resolution, creating and publishing gems
- **ruby-standard-library**: Enumerable, File I/O, Time/Date, Regular Expressions, Arrays, Hashes, and core classes

## Installation

For `han` CLI installation instructions, visit [han.guru](https://han.guru).

```bash
han install buki-ruby
```

## Usage

Once installed, this buki automatically validates your Ruby code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Syntax checking ensures code is valid before completion

## Requirements

- Ruby 3.0 or higher recommended
- Bundler for dependency management (when working with gems)

## Skills Overview

### Object-Oriented Programming

Learn Ruby's elegant OOP features:

- Classes, modules, and inheritance
- Mixins and composition patterns
- Method visibility (public, private, protected)
- Class and instance variables
- Struct and OpenStruct

### Blocks, Procs, and Lambdas

Master Ruby's functional programming:

- Block syntax and yielding
- Procs vs Lambdas
- Closures and scope
- Higher-order functions
- Currying and partial application

### Metaprogramming

Harness Ruby's dynamic nature:

- Dynamic method definition
- method_missing and const_missing
- Reflection and introspection
- Hook methods
- DSL creation

### Gems and Bundler

Manage dependencies effectively:

- Gemfile and Bundler commands
- Creating and publishing gems
- Gemspec configuration
- Version constraints
- Private gem sources

### Standard Library

Utilize Ruby's built-in power:

- Enumerable methods (map, select, reduce, etc.)
- Arrays and Hashes
- File I/O and directories
- Regular expressions
- Time and Date handling
- Ranges and Sets

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
