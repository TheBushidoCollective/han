---
workflow: adversarial
created: 2026-01-31
status: complete
---

# Session Data Encryption & Security Architecture

## Problem

The han-team-platform stores sensitive session data (user prompts, tool outputs, summaries) in **plaintext**. This creates significant security risks:

- User prompts may contain API keys, passwords, credentials
- Tool outputs might expose file contents with secrets
- Session summaries could contain sensitive information
- A database breach exposes all customer data

Users expect their Claude Code sessions to be protected with enterprise-grade security.

## Solution

Implement comprehensive encryption-at-rest with:

1. **Per-team/per-user encryption keys** - Derived from secrets using Argon2id KDF
2. **AES-256-GCM encryption** - Industry-standard authenticated encryption
3. **Secret detection** - Pattern + entropy analysis before sync with auto-redaction
4. **Full audit logging** - Track all data access with tamper-evident logs
5. **Encrypted export** - Users can export their data protected with their key

Key hierarchy:
- Team-owned repos → team encryption key (derived from team secret)
- User-owned repos → user encryption key (derived from user secret)
- Users in multiple teams → access to each team's key via membership

## Success Criteria

- [x] Session content (summary, metadata, messages) encrypted with AES-256-GCM before storage
- [x] Per-team encryption keys derived from team secret using Argon2id KDF
- [x] Per-user encryption keys for personal repos (not team-owned)
- [x] Users with multi-team membership can access each team's data with appropriate keys
- [x] Secret detection (pattern-based + entropy analysis) scans content before sync
- [x] Detected secrets auto-redacted with `[REDACTED:type]` markers before encryption
- [x] Full audit log of session access (who, what, when, IP, action)
- [x] Audit logs stored separately and tamper-evident (append-only)
- [x] Encrypted data export endpoint for users to download their sessions
- [x] `pgcrypto` extension enabled and used for Railway/Postgres deployment
- [x] Existing API endpoints updated to decrypt on read, encrypt on write
- [x] Key rotation mechanism for team/user keys without data loss

## Context

**Deployment target:** Railway with PostgreSQL (use pgcrypto extension)

**Existing infrastructure:**
- PostgreSQL via `pg` package
- Redis for caching/sessions
- JWT_SECRET and SESSION_SECRET already in config
- Zod-validated config schema

**Key decisions:**
- Database-derived keys (no external KMS dependency)
- Application-level encryption (works if migrating away from Railway)
- Pattern + entropy-based secret detection (balance accuracy vs performance)
- Adversarial workflow with red-team review for security validation
