# Jutsu: Fnox

Validation and quality enforcement for Fnox secrets management projects.

## What This Jutsu Provides

### Validation Hooks

- **Configuration Validation**: Runs `fnox doctor` to check fnox.toml configuration
- **Provider Verification**: Validates provider configurations and connectivity
- **Secrets Verification**: Ensures secrets can be resolved correctly
- **Automatic Execution**: Validates when you finish conversations in Claude Code

### Skills

This jutsu provides the following skills:

- **configuration**: Managing fnox.toml structure, secrets, profiles, and hierarchical configurations
- **providers**: Configuring encryption (age, AWS KMS) and secret storage (AWS Secrets Manager, Azure Key Vault, GCP, Vault, 1Password, Bitwarden)
- **security-best-practices**: Security guidelines for key management, access control, and secrets lifecycle

## Installation

Install via the Han marketplace:

```bash
han plugin install jutsu-fnox
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-fnox@han
```

## Usage

Once installed, this jutsu automatically validates your Fnox configuration:

- When you finish a conversation with Claude Code
- Before commits (when combined with git hooks)
- Validates fnox.toml syntax, provider configurations, and secret accessibility

## What Gets Validated

### Configuration Checks

- fnox.toml syntax and structure
- Provider definitions and configuration
- Secret references and accessibility
- Profile configurations
- Import statement validity

### Provider Validation

- Provider connectivity and authentication
- Encryption key availability
- Cloud provider credentials
- Password manager CLI availability

### Security Checks

- Unencrypted sensitive data warnings
- Private key exposure detection
- Configuration best practices

## Requirements

- Fnox 0.1.0+ installed
- Projects using fnox.toml for secrets management
- Appropriate provider CLIs installed (age, AWS CLI, gcloud, etc.)

## Example Project Structure

```
my-project/
├── fnox.toml              # Main secrets configuration
├── fnox.local.toml        # Local overrides (gitignored)
├── fnox.production.toml   # Production profile
├── fnox.staging.toml      # Staging profile
├── .gitignore             # Ignore fnox.local.toml
└── src/
```

## Common Validation Errors

### Missing Provider Definition

```toml
# ❌ Invalid
[secrets]
API_KEY = { provider = "nonexistent", value = "..." }

# ✅ Valid
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]

[secrets]
API_KEY = { provider = "age", value = "age[...]" }
```

### Unencrypted Sensitive Data

```toml
# ❌ Invalid (security warning)
[secrets]
DATABASE_PASSWORD = "plain-text-password"

# ✅ Valid
[secrets]
DATABASE_PASSWORD = { provider = "age", value = "age[...]" }
```

### Invalid Provider Configuration

```toml
# ❌ Invalid
[providers.age]
# Missing required fields

# ✅ Valid
[providers.age]
type = "age"
public_keys = ["age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"]
```

## Security Best Practices

### Always Use Encryption

```toml
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]

[secrets]
SENSITIVE_DATA = { provider = "age", value = "age[...]" }
```

### Separate Public and Private Config

```toml
# fnox.toml (committed)
[providers.age]
public_keys = ["age1ql3z..."]

# fnox.local.toml (gitignored)
[providers.age]
identity = "~/.config/fnox/keys/identity.txt"
```

### Use Profiles for Environments

```bash
# Development
fnox exec -- node app.js

# Production
FNOX_PROFILE=production fnox exec -- node app.js
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
