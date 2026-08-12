# Harness Feature Parity

Tracks han's coverage of the upstream harness feature surface it integrates
with. The primary harness is Claude Code; the bridge plugins map the same
surface onto OpenCode, Gemini CLI, Kiro, Codex, and Antigravity.

**Upstream baseline: Claude Code 2.1.228** (npm `@anthropic-ai/claude-code`
`latest` dist-tag). Re-run the audit whenever the baseline moves.

## How to re-run this audit

1. Read the npm `latest` dist-tag for `@anthropic-ai/claude-code`. That version
   is the baseline, not the version referenced in source comments.
2. Read the upstream reference pages, which are the schema source of truth:
   - `https://code.claude.com/docs/en/hooks.md`
   - `https://code.claude.com/docs/en/plugins-reference.md`
   - `https://code.claude.com/docs/en/plugin-marketplaces.md`
   - `https://code.claude.com/docs/en/plugin-dependencies.md`
   - `https://code.claude.com/docs/en/plugin-relevance.md`
   - `https://code.claude.com/docs/en/changelog.md`
3. Diff each table below against the docs, then close every gap before
   updating the baseline line above.

## Hook events

Source of truth in han: `packages/han/lib/hooks/hook-config.ts`
(`HookEventType`, `VALID_EVENT_TYPES`).

Status is filled in by the audit; see the gap register below for open items.

## Hook handler types

Upstream supports five handler types: `command`, `http`, `mcp_tool`, `prompt`,
and `agent`.

## Plugin manifest schema

Upstream `.claude-plugin/plugin.json` fields, and han's `han-plugin.yml`
superset.

## Marketplace schema

Upstream `.claude-plugin/marketplace.json` fields.

## Gap register

Open gaps are tracked in this section and closed in the same change that
records them.
