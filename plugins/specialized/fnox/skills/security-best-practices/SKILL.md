---
name: fnox-security-best-practices
description: Use when implementing secure secrets management with Fnox. Covers encryption, key management, access control, and security hardening.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Fnox - Security Best Practices

Security guidelines and best practices for managing secrets with Fnox.

## Encryption Fundamentals

### Always Encrypt Sensitive Data

```toml
# Bad: Plain text secrets committed to git
[secrets]
DATABASE_PASSWORD = "super-secret-password"
API_KEY = "sk-live-12345"

# Good: Encrypted secrets
[providers.age]
type = "age"
public_keys = ["age1ql3z..."]

[secrets]
DATABASE_PASSWORD = { provider = "age", value = "age[...]" }
API_KEY = { provider = "age", value = "age[...]" }
```

### Use Strong Encryption

```bash
# Good: age encryption (modern, secure)
age-keygen -o ~/.config/fnox/keys/identity.txt

# Good: Cloud KMS (managed encryption)
[providers.kms]
type = "aws-kms"
key_id = "arn:aws:kms:us-east-1:..."
```

## Key Management

### Protect Private Keys

```bash
# Store age private key securely
chmod 600 ~/.config/fnox/keys/identity.txt

# Never commit private keys
echo "*.txt" >> ~/.config/fnox/keys/.gitignore
```

### Separate Public and Private Keys

```toml
# fnox.toml (committed) - public keys only
[providers.age]
type = "age"
public_keys = ["age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"]

# fnox.local.toml (gitignored) - private keys
[providers.age]
identity = "~/.config/fnox/keys/identity.txt"
```

### Rotate Keys Regularly

```bash
# Generate new age key
age-keygen -o ~/.config/fnox/keys/identity-2025.txt

# Re-encrypt all secrets with new key
fnox get --all | fnox set --provider age-new
```

## Access Control

### Use Least Privilege

```toml
# Good: Separate secrets by environment
[profiles.production]
[profiles.production.providers.prod-secrets]
type = "aws-sm"
region = "us-east-1"

[profiles.production.secrets]
DATABASE_URL = { provider = "prod-secrets", value = "prod/db" }

[profiles.development]
[profiles.development.secrets]
DATABASE_URL = "postgresql://localhost/dev"  # Non-sensitive
```

### Team Access Control

```toml
# Multiple age recipients for team
[providers.age]
type = "age"
public_keys = [
  "age1ql3z...",  # Alice (admin)
  "age1qw4r...",  # Bob (developer)
  # Don't include contractors or temporary team members
]
```

### Role-Based Secrets

```toml
# Backend secrets
[providers.backend]
type = "aws-sm"
region = "us-east-1"

# Frontend secrets (different access level)
[providers.frontend]
type = "aws-sm"
region = "us-east-1"

[secrets]
BACKEND_DB_PASSWORD = { provider = "backend", value = "backend/db-pass" }
FRONTEND_API_ENDPOINT = { provider = "frontend", value = "frontend/api-url" }
```

## Git Security

### Never Commit Sensitive Data

```gitignore
# .gitignore
fnox.local.toml
*.age-identity.txt
*.key
*.pem
.env
```

### Audit Git History

```bash
# Check for accidentally committed secrets
git log -p | grep -i "password\|secret\|key"

# Remove secrets from git history (if found)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch fnox.local.toml' \
  --prune-empty --tag-name-filter cat -- --all
```

### Use Pre-Commit Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached --name-only | grep -q "fnox.local.toml"; then
  echo "Error: Attempting to commit fnox.local.toml"
  exit 1
fi

# Check for plain text secrets
if git diff --cached | grep -q "password.*=.*\"[^a]"; then
  echo "Warning: Possible plain text password detected"
  exit 1
fi
```

## Environment Separation

### Separate Development and Production

```toml
# fnox.toml (development)
[secrets]
DATABASE_URL = "postgresql://localhost/dev"
DEBUG = "true"

# fnox.production.toml (production secrets)
[providers.prod]
type = "aws-sm"
region = "us-east-1"

[secrets]
DATABASE_URL = { provider = "prod", value = "prod/db-url" }
DEBUG = "false"
```

### Use Profiles for Environments

```bash
# Development
fnox exec -- node app.js

# Staging
FNOX_PROFILE=staging fnox exec -- node app.js

# Production
FNOX_PROFILE=production fnox exec -- node app.js
```

## Cloud Provider Security

### AWS Best Practices

```toml
# Use IAM roles instead of access keys
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"
# No access_key_id or secret_access_key
# Uses IAM role or AWS credentials chain

# Restrict by resource tags
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"
# Ensure IAM policy limits access to specific secrets
```

### Azure Best Practices

```toml
# Use managed identity
[providers.azure]
type = "azure-kv"
vault_url = "https://my-vault.vault.azure.net"
# Authentication via Azure managed identity
```

### GCP Best Practices

```toml
# Use service account with minimal permissions
[providers.gcp]
type = "gcp-sm"
project_id = "my-project"
# Service account with only secretmanager.versions.access
```

## Audit and Monitoring

### Log Secret Access

```bash
# Enable audit logging in cloud providers
# AWS CloudTrail for Secrets Manager
# Azure Monitor for Key Vault
# GCP Cloud Audit Logs for Secret Manager
```

### Monitor for Anomalies

```bash
# Check which secrets are accessed
fnox list

# Verify provider configuration
fnox doctor

# Test provider connectivity
fnox provider test aws-sm
```

### Regular Security Audits

```bash
# List all secrets
fnox list

# Verify encryption status
fnox doctor

# Check for plain text secrets
grep -r "password.*=.*\"[^a]" fnox.toml
```

## Secrets Lifecycle

### Rotate Secrets Regularly

```bash
# Generate new secret
NEW_PASSWORD=$(openssl rand -base64 32)

# Update in fnox
echo "$NEW_PASSWORD" | fnox set DATABASE_PASSWORD

# Update in actual service (database, API, etc.)
# Then verify application still works
```

### Remove Obsolete Secrets

```bash
# Remove unused secret
fnox unset OLD_API_KEY

# Clean up from cloud provider
aws secretsmanager delete-secret --secret-id old/api-key
```

### Document Secret Purpose

```toml
[secrets]
STRIPE_API_KEY = {
  provider = "age",
  value = "age[...]",
  description = "Stripe secret key for payment processing. Rotate quarterly."
}

DATABASE_PASSWORD = {
  provider = "aws-sm",
  value = "prod/db-password",
  description = "PostgreSQL master password. Last rotated: 2025-01-01"
}
```

## CI/CD Security

### Use Dedicated CI Keys

```toml
# Separate age key for CI/CD
[providers.age]
type = "age"
public_keys = [
  "age1ql3z...",  # Developer key
  "age1ci3d...",  # CI/CD key (limited access)
]
```

### Restrict CI Secret Access

```yaml
# .github/workflows/deploy.yml
env:
  FNOX_PROFILE: production
  # Use GitHub secrets for age identity
  AGE_IDENTITY: ${{ secrets.AGE_IDENTITY }}

steps:
  - name: Load secrets
    run: |
      echo "$AGE_IDENTITY" > /tmp/identity.txt
      chmod 600 /tmp/identity.txt
      fnox exec -- ./deploy.sh
      rm /tmp/identity.txt
```

### Minimal CI Permissions

```toml
# CI profile with minimal secrets
[profiles.ci]
[profiles.ci.secrets]
DEPLOY_TOKEN = { provider = "age", value = "age[...]" }
# Don't include database passwords or API keys
```

## Best Practices Summary

### DO

✅ Always encrypt sensitive secrets
✅ Use strong encryption (age, KMS)
✅ Store private keys securely
✅ Separate dev and prod secrets
✅ Use .gitignore for local overrides
✅ Rotate keys and secrets regularly
✅ Use cloud provider managed identities
✅ Audit secret access
✅ Document secret purpose
✅ Use profiles for environments

### DON'T

❌ Never commit private keys
❌ Never use plain text for sensitive data
❌ Don't share private keys between team members
❌ Don't hardcode credentials
❌ Don't mix dev and prod secrets
❌ Don't skip encryption in production
❌ Don't ignore security warnings
❌ Don't use weak passwords as secrets

## Common Threats and Mitigations

### Threat: Accidental Commit

```bash
# Mitigation: Pre-commit hooks
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/bash
if git diff --cached fnox.local.toml > /dev/null; then
  echo "Error: fnox.local.toml should not be committed"
  exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

### Threat: Key Compromise

```bash
# Mitigation: Immediate rotation
# 1. Generate new key
age-keygen -o ~/.config/fnox/keys/identity-new.txt

# 2. Re-encrypt all secrets
fnox get --all | fnox set --provider age-new

# 3. Update public keys
# 4. Revoke old key
```

### Threat: Unauthorized Access

```toml
# Mitigation: Use cloud provider IAM
[providers.aws-sm]
type = "aws-sm"
region = "us-east-1"
# Restrict with IAM policies:
# - Limit to specific secret ARNs
# - Require MFA
# - Restrict by IP range
```

## Related Skills

- **configuration**: Managing fnox.toml securely
- **providers**: Choosing secure providers
