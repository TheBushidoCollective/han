# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously and appreciate your help in responsibly disclosing vulnerabilities.

### How to Report

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them by:

1. **Email**: Send details to the project maintainers
2. **Private Security Advisory**: Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)

### What to Include

Please provide:

- Type of vulnerability (e.g., command injection, path traversal)
- Full path to the affected source file(s)
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact assessment

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days (depending on complexity)

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your report
2. **Validation**: We'll investigate and validate the issue
3. **Fix Development**: We'll work on a fix privately
4. **Coordinated Disclosure**: We'll coordinate release timing with you
5. **Credit**: We'll credit you in the release notes (unless you prefer anonymity)

## Security Best Practices

### For Plugin Authors

When creating plugins:

- Never execute untrusted input directly
- Validate all file paths and user inputs
- Use `--fail-fast` to stop on first error
- Avoid storing sensitive data in plugin files
- Test hooks in isolated environments

### For Users

When using han and plugins:

- Only install plugins from trusted sources
- Review hook commands before installation
- Keep han updated to the latest version
- Use `han plugin list` to audit installed plugins
- Report suspicious plugins to maintainers

## Security Features

### Hook Execution

- Hooks run in the user's shell context
- Commands are executed as-is (no shell injection protection by default)
- Use `--cache` to avoid re-running expensive validations

### Plugin Installation

- Plugins are fetched from the official marketplace
- Plugin metadata is validated during installation
- MCP servers run with user permissions

## Known Limitations

- Hooks execute arbitrary commands defined in plugin configurations
- Plugin authors should be trusted before installation
- MCP servers may have access to external services

## Acknowledgments

We thank all security researchers who have helped make han more secure.

---

*"In matters of truth and justice, there is no difference between large and small problems."* - Shissai Chozan
