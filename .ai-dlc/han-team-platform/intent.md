---
workflow: default
created: 2026-01-30T08:18:00-07:00
status: completed
completed: 2026-01-30
---

# Han Team Platform

## Problem

Currently, han browse is a local-only experience. Teams using Claude Code with han have no visibility into:
- How team members are using AI
- What agents are working on across the organization
- Shared learnings and patterns that could benefit everyone
- Aggregated metrics for understanding AI-assisted development

Managers and team leads have no way to understand AI usage patterns, and individuals can't learn from each other's sessions.

## Solution

Build a hosted team platform that extends han browse into a multi-tenant SaaS (with self-hosted option). Following the n8n/Sentry model:
- Cloud-hosted version at han.guru (commercial service)
- Self-hosted option via Docker Compose and Helm chart

### Architecture

- **Organization Hierarchy**: Organization → Teams → Projects → Repos
- **Privacy Model**: Aggregated metrics visible by default, session details follow repo permissions
- **Authentication**: GitHub OAuth, GitLab OAuth, email fallback (SSO later)
- **Data Sync**: Async sync from local han instances to hosted service
- **Retention**: Tiered by plan (Free: 30d, Pro: 1y, Enterprise: unlimited)

### Privacy Principles

1. **Personal repos stay private** - Sessions on repos not owned by the org are invisible to the org
2. **Repo permissions mirror session access** - If you can see the repo, you can see its sessions
3. **Aggregated metrics always visible** - Time, task counts, outcomes visible to team even when sessions are private
4. **Manager access configurable** - Each organization decides their visibility policy
5. **Memory respects boundaries** - Cross-session queries only synthesize from permitted sessions

## Success Criteria

### Core Platform
- [ ] Multi-tenant backend with org → team → project → repo hierarchy
- [ ] Authentication via GitHub OAuth, GitLab OAuth, and email fallback
- [ ] User roles: Owner, Admin, Member, Viewer (configurable per org)
- [ ] Single browse-client codebase works in both local and hosted modes
- [ ] All local features (session view, messages, tasks, metrics) available in hosted mode

### Data Sync
- [ ] Local han instances sync session data to hosted service
- [ ] Sync is async and resilient to network interruptions
- [ ] Sync respects privacy settings (personal repos excluded)

### Session Viewing
- [ ] Team members can view sessions they have permission to see
- [ ] Repo permissions from git provider determine session access
- [ ] Real-time session list updates as new data syncs

### Privacy & Permissions
- [ ] Personal repo sessions are private to the individual
- [ ] Org-owned repo sessions visible to users with repo access
- [ ] Manager visibility configurable per organization
- [ ] Aggregated metrics visible even when sessions are private

### Metrics & Memory
- [ ] Team dashboard with aggregated metrics (sessions, tasks, outcomes)
- [ ] Shared memory can query across permitted sessions
- [ ] Memory respects privacy boundaries in responses

### Deployment
- [ ] Cloud deployment on han.guru (managed SaaS)
- [ ] Self-hosted via Docker Compose (simpler environments)
- [ ] Self-hosted via Helm chart (Kubernetes/enterprise)
- [ ] Tiered data retention (Free: 30d, Pro: 1y, Enterprise: unlimited)

## Context

### Existing Foundation
- `packages/han/lib/commands/browse/` - Existing local browse implementation
- `packages/browse-client/` - React/Relay frontend
- GraphQL API with SQLite backend (local)
- Session indexing from JSONL transcripts

### Technical Decisions

**CRITICAL: Single Codebase Principle**
The hosted team platform is an **extension of browse-client**, not a separate application. Every feature available locally to a single user MUST also be available in the hosted version. This means:
- One React/Relay frontend codebase (`packages/browse-client/`)
- One GraphQL schema with mode-aware resolvers
- Local mode: SQLite backend, no auth required
- Hosted mode: PostgreSQL backend, auth + permissions layer
- Feature flags or runtime detection, NOT code forks

**Implementation approach:**
- Browse-client detects mode via environment/config
- GraphQL resolvers abstract over SQLite (local) vs PostgreSQL (hosted)
- Auth layer is optional middleware (bypassed in local mode)
- Team features (org hierarchy, permissions) only appear in hosted mode
- All core features (session viewing, messages, tasks, metrics) work in both modes

### Commercial Model
- Free tier with limited retention
- Pro tier for individuals/small teams
- Enterprise tier for organizations with SSO and self-hosted options
