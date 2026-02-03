# Languages

This directory contains **programming language** plugins - skills and validation for specific programming languages.

## What are Language Plugins?

Language plugins provide deep expertise in specific programming languages, including:

- **Language fundamentals** - Syntax, idioms, and best practices
- **Advanced patterns** - Concurrency, metaprogramming, type systems
- **LSP servers** - IDE-like features for code navigation and diagnostics
- **Validation hooks** - Language-specific quality enforcement

## Available Languages

### Systems Programming

- **c** - C programming with memory management and systems programming
- **cpp** - Modern C++ with templates and metaprogramming
- **rust** - Ownership, error handling, and async programming
- **nim** - Systems programming and metaprogramming
- **crystal** - Ruby-like syntax with C-like performance

### JVM Ecosystem

- **java** - Streams, concurrency, and generics
- **kotlin** - Coroutines and DSL patterns
- **scala** - Functional programming and type systems

### BEAM Ecosystem

- **elixir** - OTP, pattern matching, and Ecto
- **erlang** - Concurrent and distributed systems
- **gleam** - Functional BEAM development

### Web Development

- **typescript** - Type system mastery and validation
- **python** - Type system, async patterns, and data modeling
- **ruby** - OOP, metaprogramming, and blocks
- **php** - Modern PHP and security patterns

### Apple Platforms

- **swift** - Protocol-oriented programming and concurrency
- **objective-c** - iOS and macOS development with ARC

### Scripting & Embedded

- **lua** - Embedded scripting and game development
- **go** - Concurrency, error handling, and interfaces

## Plugin Structure

Each language plugin follows this structure:

```text
{language}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata with LSP config
├── skills/
│   └── {skill-name}/
│       └── SKILL.md         # Skill implementation
├── scripts/
│   └── lsp-entrypoint.sh    # LSP server launcher
├── han-plugin.yml           # Hook definitions
└── README.md                # Plugin documentation
```

## LSP Servers

Most language plugins include LSP (Language Server Protocol) servers for:

- Code completion
- Go to definition
- Find references
- Hover documentation
- Diagnostics

The LSP servers are defined in each plugin's `plugin.json` under `lspServers`.

## Usage

Install language plugins based on your project needs:

```bash
# Install TypeScript support
han plugin install typescript

# Install Rust support
han plugin install rust

# Install Python support
han plugin install python
```

## License

Apache-2.0 - see individual plugin directories for details.
