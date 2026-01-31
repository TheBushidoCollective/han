# Jutsu: Sentry

Best practices and patterns for Sentry error monitoring and observability.

## What This Jutsu Provides

### Validation Hooks

- **Sentry Info**: Verifies sentry-cli configuration and authentication using `sentry-cli info`

### Skills

This jutsu provides the following skills:

- **SDK Configuration**: Initialization, integrations, sampling, filtering
- **Error Capturing**: Exception handling, context, breadcrumbs, fingerprinting
- **Performance Monitoring**: Transactions, spans, distributed tracing, metrics
- **Release Management**: Source maps, deployments, release health
- **Alerts & Issues**: Alert rules, issue triage, notifications, integrations

## Installation

Install via the Han marketplace:

```bash
han plugin install jutsu-sentry
```

## Usage

Once installed, this jutsu provides skills for Sentry best practices. The validation hook verifies your sentry-cli configuration is correct.

## Requirements

- [sentry-cli](https://docs.sentry.io/cli/) installed
- `.sentryclirc` or `sentry.properties` configuration file
- Valid Sentry authentication token

## Configuration

Create `.sentryclirc` in your project root:

```ini
[defaults]
org = your-org
project = your-project

[auth]
token = your-auth-token
```

Or use environment variables:

```bash
export SENTRY_ORG=your-org
export SENTRY_PROJECT=your-project
export SENTRY_AUTH_TOKEN=your-auth-token
```
