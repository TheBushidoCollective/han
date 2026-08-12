# Harness Feature Parity

Tracks han's coverage of the upstream harness surface it integrates with. The
primary harness is Claude Code; the bridge plugins map the same surface onto
OpenCode, Gemini CLI, Kiro, Codex, and Antigravity.

**Upstream baseline: Claude Code 2.1.228** (npm `@anthropic-ai/claude-code`
`latest` dist-tag).

## How to re-run this audit

1. Read the npm `latest` dist-tag for `@anthropic-ai/claude-code`. That version
   is the baseline. Do not take the version from a source comment; comments go
   stale, which is exactly how the 2.1.215 pin survived thirteen releases.
2. Read the upstream reference pages, which are the schema source of truth:
   - `https://code.claude.com/docs/en/hooks.md`
   - `https://code.claude.com/docs/en/plugins-reference.md`
   - `https://code.claude.com/docs/en/plugin-marketplaces.md`
   - `https://code.claude.com/docs/en/changelog.md`
   These paginate. Read them in ranges (`:301-1322`) or you will silently get
   the first 50 KB and conclude a section does not exist.
3. Diff each table below against the docs. Close every gap before moving the
   baseline line above.

## Hook events

Single source of truth: `HOOK_EVENT_TYPES` in
`packages/han/lib/hooks/hook-config.ts`. The `HookEventType` union, shorthand
validation, and generated `hooks.json` key ordering all derive from that one
array. Adding an upstream event is a one-line change there.

All 31 upstream events are supported: `SessionStart`, `Setup`,
`UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PermissionRequest`,
`PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`,
`Notification`, `MessageDisplay`, `Stop`, `SubagentStop`, `SubagentStart`,
`TaskCreated`, `TaskCompleted`, `StopFailure`, `TeammateIdle`,
`InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `DirectoryAdded`,
`FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`,
`Elicitation`, `ElicitationResult`, `SessionEnd`.

`han hook test` generates a realistic stdin payload for every one of them, with
the event-specific fields taken from the upstream input schemas.

## Hook handler types

Upstream defines five: `command`, `http`, `mcp_tool`, `prompt`, and `agent`.

han's dispatcher executes `command` handlers only. The other four are executed
by Claude Code itself, so running them here would double-fire them. The
`HookEntry` type carries the full union so an unrecognized type is a
recognized-and-skipped case rather than a silent fallthrough.

`han hook dispatch` exists to work around Claude Code issue 12151, where plugin
hook stdout does not reach the agent on context-injecting events. Two
constraints that are easy to break:

- `timeout` in a `hooks.json` entry is **seconds**. `execSync` takes
  **milliseconds**. Passing one to the other directly means every hook is killed
  before it starts.
- `plugins/core` registers `han hook dispatch <Event>` as one of its own
  `hooks.json` entries for eight events. The dispatcher rediscovers that entry
  when it scans plugins, so it must refuse to recurse. `HAN_DISPATCH=1`, set on
  every child process, is the guard.

## Plugin directory resolution

Single source of truth: `packages/han/lib/hooks/plugin-discovery.ts`.

`.claude-plugin/marketplace.json` is authoritative. It is the only place that
knows both the current `plugins/<category>/<name>` layout and every published
legacy alias, and it does not require the plugin to have a `han-plugin.yml`,
which agent-only and MCP-only plugins do not. Scanning for `han-plugin.yml` is
the fallback for plugins the manifest omits.

Never reintroduce a hardcoded directory probe. The previous
`jutsu/`, `do/`, `hashi/`, root list matched zero of the plugins on disk.

## Plugin manifest schema

Upstream makes `name` the only required field and ignores top-level fields it
does not recognize, so han reports an unrecognized field as a warning and never
fails a plugin for it.

`han plugin validate` recognizes the 26 upstream `plugin.json` fields:
`$schema`, `name`, `displayName`, `version`, `description`, `author`,
`homepage`, `repository`, `license`, `keywords`, `metadata`, `defaultEnabled`,
`strict`, `skills`, `commands`, `agents`, `workflows`, `hooks`, `mcpServers`,
`outputStyles`, `lspServers`, `experimental`, `userConfig`, `channels`,
`settings`, `dependencies`, plus `themes` and `monitors` as recognized
top-level keys that warn about the coming `experimental.*` requirement.

Two machine-readable cross-checks worth re-running, because they catch drift a
doc read misses:

- `https://json.schemastore.org/claude-code-plugin-manifest.json` against the
  recognized field set.
- `https://json.schemastore.org/claude-code-marketplace.json` against
  `.claude-plugin/marketplace.json`.

The schemastore snapshots lag the reference docs, so a field present in han and
absent from the schema is not automatically wrong. Confirm against the docs
before removing anything.


## han-plugin.yml schema

han's own plugin config has two independent readers, and the validator's
allow-list must be the union of what both consume, not what either one declares:

- `packages/han/lib/hooks/hook-config.ts` (`YamlPluginHookDefinition`) for the
  hook runtime.
- `packages/han/lib/commands/plugin/generate-hooks.ts`, which reads `sync`.

An unrecognized key here is fatal to the whole plugin, so a field must be listed
the moment any reader consumes it. Top-level keys: `hooks`, `mcp_servers`,
`memory`, and `learn_patterns` (read by `marker-detection.ts` and surfaced as
`detection.learnPatterns` for prompt-based auto-detection).

`loadPluginConfig` validates the raw YAML before conversion. Validating the
converted camelCase config checks a shape the file never has.

## Upstream surface han deliberately does not model

These are Claude Code plugin components that han's tooling does not generate,
validate beyond field recognition, or wrap. They work because Claude Code
discovers them natively from the plugin directory:

`agents/`, `skills/`, `workflows/`, `output-styles/`, `themes/`, `monitors/`,
`bin/` (executables added to the Bash tool's PATH), `settings.json`,
`.lsp.json`, `userConfig`, and `channels`.

If han grows opinions about any of them, that is a feature decision, not a
parity gap.

## Enforcement

`han plugin generate-hooks --all --check` byte-diffs every generated
`hooks.json` against what its `han-plugin.yml` produces. `han plugin validate`
checks manifests and structure. Both run in CI. A plugin with a `hooks.json` but
no `han-plugin.yml` is invisible to both, so every plugin that ships hooks must
carry a `han-plugin.yml`.
