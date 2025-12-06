---
name: fnox-providers
description: Use when configuring Fnox providers for encryption and secret storage. Covers age encryption, cloud providers (AWS, Azure, GCP), and password managers.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Fnox - Providers

Configuring encryption and secret storage providers in Fnox for secure secrets management.

## Provider Types

Fnox supports three categories of providers:

1. **Encryption** - Local encryption (age, AWS KMS, Azure, GCP)
2. **Cloud Storage** - Remote secret storage (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, Vault)
3. **Password Managers** - Integration with password managers (1Password, Bitwarden, Infisical, pass)

## Age Encryption (Recommended)

### Setup Age Provider

```bash
# Generate age key pair
age-keygen -o ~/.config/fnox/keys/identity.txt

# Get public key
cat ~/.config/fnox/keys/identity.txt | grep "public key"
# age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
```

### Configure Age in fnox.toml

```toml
# fnox.toml (committed)
[providers.age]
type = "age"
public_keys = ["age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"]

# fnox.local.toml (gitignored)
[providers.age]
identity = "~/.config/fnox/keys/identity.txt"
```

### Store Secrets with Age

```bash
# Set encrypted secret
fnox set DATABASE_PASSWORD
# Prompts for value, encrypts with age public key

# Set from command
echo "secret-value" | fnox set API_KEY --provider age
```

### Team Setup with Age

```toml
# Multiple recipients for team access
[providers.age]
type = "age"
public_keys = [
  "age1ql3z...",  # Alice
  "age1qw4r...",  # Bob
  "age1qx5t...",  # CI/CD
]
```

## AWS Secrets Manager

### Configure AWS Secrets Manager

```toml
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"
# Optional: profile = "production"
```

### Store Secrets in AWS

```bash
# Reference AWS secret
fnox set DATABASE_URL --provider aws-sm
# Enter: prod/database-url (AWS secret name)
```

### AWS Secrets Manager Configuration

```toml
[secrets]
DATABASE_URL = {
  provider = "aws-sm",
  value = "prod/database-url",
  description = "Production database connection string"
}

API_KEY = {
  provider = "aws-sm",
  value = "prod/api-key"
}
```

## AWS KMS Encryption

### Configure AWS KMS

```toml
[providers.kms]
type = "aws-kms"
key_id = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
region = "us-east-1"
```

### Use AWS KMS

```bash
# Encrypt with KMS
fnox set SECRET_KEY --provider kms
```

## Azure Key Vault

### Configure Azure

```toml
[providers.azure]
type = "azure-kv"
vault_url = "https://my-vault.vault.azure.net"
# Authentication via Azure CLI or environment variables
```

### Azure Secrets

```toml
[secrets]
DATABASE_PASSWORD = {
  provider = "azure",
  value = "database-password",
  description = "Azure Key Vault secret name"
}
```

## GCP Secret Manager

### Configure GCP

```toml
[providers.gcp]
type = "gcp-sm"
project_id = "my-project"
# Authentication via gcloud or service account
```

### GCP Secrets

```toml
[secrets]
API_KEY = {
  provider = "gcp",
  value = "projects/my-project/secrets/api-key/versions/latest"
}
```

## HashiCorp Vault

### Configure Vault

```toml
[providers.vault]
type = "vault"
address = "https://vault.example.com"
token = { env = "VAULT_TOKEN" }  # From environment
```

### Vault Secrets

```toml
[secrets]
DATABASE_URL = {
  provider = "vault",
  value = "secret/data/prod/database-url"
}
```

## 1Password

### Configure 1Password

```toml
[providers.onepassword]
type = "1password"
# Requires 1Password CLI (op) installed
```

### 1Password References

```toml
[secrets]
API_KEY = {
  provider = "onepassword",
  value = "op://Production/API Keys/api-key"
}

DATABASE_PASSWORD = {
  provider = "onepassword",
  value = "op://Production/Database/password"
}
```

## Bitwarden

### Configure Bitwarden

```toml
[providers.bitwarden]
type = "bitwarden"
# Requires Bitwarden CLI (bw) installed and unlocked
```

### Bitwarden Secrets

```toml
[secrets]
STRIPE_KEY = {
  provider = "bitwarden",
  value = "item-id/field-name"
}
```

## Provider Testing

### Test Provider Configuration

```bash
# Test specific provider
fnox provider test age
fnox provider test aws-sm

# List configured providers
fnox provider list

# Add provider interactively
fnox provider add

# Remove provider
fnox provider remove age
```

## Best Practices

### Choose the Right Provider

```toml
# Development: age (simple, local encryption)
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]

# Production: Cloud secret manager
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"

# Team collaboration: 1Password or Bitwarden
[providers.onepassword]
type = "1password"
```

### Use Multiple Providers

```toml
# Different providers for different secrets
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]

[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"

[secrets]
# Development secrets with age
DEV_API_KEY = { provider = "age", value = "age[...]" }

# Production secrets with AWS
PROD_DATABASE_URL = { provider = "aws-sm", value = "prod/db-url" }
```

### Provider Aliases

```toml
# Name providers descriptively
[providers.prod-secrets]
type = "aws-sm"
region = "us-east-1"

[providers.staging-secrets]
type = "aws-sm"
region = "us-west-2"

[secrets]
DATABASE_URL = { provider = "prod-secrets", value = "prod/db" }
```

## Common Patterns

### Development to Production Migration

```toml
# fnox.toml (development)
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]

[secrets]
DATABASE_URL = { provider = "age", value = "age[...]" }

# fnox.production.toml
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"

[secrets]
DATABASE_URL = { provider = "aws-sm", value = "prod/database-url" }
```

### Multi-Region Setup

```toml
[providers.us-secrets]
type = "aws-sm"
region = "us-east-1"

[providers.eu-secrets]
type = "aws-sm"
region = "eu-west-1"

[secrets]
US_API_ENDPOINT = { provider = "us-secrets", value = "us/api-endpoint" }
EU_API_ENDPOINT = { provider = "eu-secrets", value = "eu/api-endpoint" }
```

### Hybrid Approach

```toml
# Development secrets: age encryption
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]

# Shared team secrets: 1Password
[providers.team]
type = "1password"

# Production secrets: AWS
[providers.prod]
type = "aws-sm"
region = "us-east-1"

[secrets]
DEV_DATABASE_URL = { provider = "age", value = "age[...]" }
TEAM_SLACK_WEBHOOK = { provider = "team", value = "op://Team/Slack/webhook" }
PROD_DATABASE_URL = { provider = "prod", value = "prod/db-url" }
```

## Anti-Patterns

### Don't Hardcode Credentials

```toml
# Bad: Hardcoded credentials
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"
access_key_id = "AKIAIOSFODNN7EXAMPLE"  # NEVER DO THIS
secret_access_key = "wJalrXUtnFEMI/..."  # NEVER DO THIS

# Good: Use AWS credentials chain
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"
# Credentials from ~/.aws/credentials or environment
```

### Don't Mix Provider Types Unnecessarily

```toml
# Bad: Too many providers for simple project
[providers.age]
type = "age"

[providers.aws-sm]
type = "aws-sm"

[providers.azure]
type = "azure-kv"

[providers.gcp]
type = "gcp-sm"

# Good: Choose one appropriate provider
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]
```

### Don't Share Private Keys

```toml
# Bad: Private key in config
[providers.age]
identity = "AGE-SECRET-KEY-..."  # NEVER COMMIT THIS

# Good: Reference external file
[providers.age]
identity = "~/.config/fnox/keys/identity.txt"  # Gitignored
```

## Provider-Specific Features

### Age: Multiple Recipients

```toml
[providers.age]
type = "age"
public_keys = [
  "age1ql3z...",  # Team member 1
  "age1qw4r...",  # Team member 2
  "age1qx5t...",  # CI/CD system
]
```

### AWS: Cross-Account Access

```toml
[providers.shared-secrets]
type = "aws-sm"
region = "us-east-1"
role_arn = "arn:aws:iam::123456789012:role/CrossAccountSecretsRole"
```

### Vault: Namespace Support

```toml
[providers.vault-prod]
type = "vault"
address = "https://vault.example.com"
namespace = "production"
token = { env = "VAULT_TOKEN" }
```

## Related Skills

- **configuration**: Managing fnox.toml structure and secrets
- **security-best-practices**: Security guidelines for providers
