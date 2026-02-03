# Jutsu: Markdown

Markdown documentation skills and linting with markdownlint.

## What This Jutsu Provides

### Validation Hooks

- **Markdownlint Validation**: Runs markdownlint on all `.md` files to enforce consistent formatting
- Validates files on session stop and when agents complete work
- Only runs when markdown files have changed (with `--cache` flag)
- Automatically fixes fixable issues with `--fix`

### Skills

This jutsu provides the following skills:

#### Markdown Fundamentals

- **markdown-syntax-fundamentals**: Core markdown syntax for headings, text formatting, lists, links, images, code blocks, and blockquotes
- **markdown-tables**: Table syntax, alignment, escaping, and best practices for complex table layouts
- **markdown-documentation**: Writing effective technical documentation, READMEs, changelogs, and API docs

#### Markdownlint

- **markdownlint-configuration**: Configure markdownlint rules and options including rule management, configuration files, and style inheritance
- **markdownlint-custom-rules**: Create custom linting rules including rule structure, parser integration, and automatic fixing
- **markdownlint-integration**: Integrate markdownlint into development workflows including CLI usage, programmatic API, and CI/CD pipelines

## Installation

Install via the Han marketplace:

```bash
han plugin install jutsu-markdown
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-markdown@han
```

## Usage

Once installed, this jutsu automatically validates your markdown files:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

### Configuration

Configure markdownlint by adding a configuration file to directories you want to lint:

- `.markdownlint.json` or `.markdownlint.jsonc` (JSON format)
- `.markdownlint.yaml` or `.markdownlint.yml` (YAML format)

Example `.markdownlint.json`:

```json
{
  "default": true,
  "MD013": false,
  "MD041": false
}
```

## Common Markdownlint Rules

| Rule | Description |
|------|-------------|
| MD001 | Heading levels should only increment by one level at a time |
| MD013 | Line length (often disabled for prose) |
| MD031 | Fenced code blocks should be surrounded by blank lines |
| MD041 | First line should be a top-level heading |
| MD056 | Table column count should be consistent |

## Overriding Hooks

Create a `han-config.yml` in directories where you want to customize behavior:

```yaml
jutsu-markdown:
  lint:
    enabled: false  # Disable markdownlint for this directory
```

Or override the command:

```yaml
jutsu-markdown:
  lint:
    command: "npx -y markdownlint-cli --fix . --disable MD013"  # Ignore line length
```
