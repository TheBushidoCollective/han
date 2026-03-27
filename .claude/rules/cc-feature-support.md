# Claude Code Feature Support

Han maintains feature parity with Claude Code releases. This file tracks which version we support.

## Current Support Level

**Supported up to:** Claude Code 2.1.63

## Features Tracked

### 2.1.63 (Current)
- **Task tool renamed to Agent** - The `Task` tool (for spawning subagents) is now called `Agent`. PreToolUse/PostToolUse matchers should match both `Agent|Task` for backward compatibility.
- HTTP hooks (`type: "http"`) - POST JSON to a URL, receive JSON response instead of running shell commands
- `/simplify` and `/batch` bundled slash commands
- Project configs and auto memory shared across git worktrees of same repository
- `ENABLE_CLAUDEAI_MCP_SERVERS=false` env var to opt out of claude.ai MCP servers
- Fixed `/clear` not resetting cached skills
- Massive memory leak fix batch (git root detection, JSON parsing, MCP caches, WebSocket listeners, hooks config, bridge polling, etc.)

### 2.1.59
- Auto-memory: Claude automatically saves useful context, managed with `/memory` command
- `/copy` command with interactive picker for selecting individual code blocks
- Improved "always allow" prefix suggestions for compound bash commands (per-subcommand prefixes)
- `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` env var to disable auto memory

### 2.1.51
- `claude remote-control` subcommand for local environment serving from any device
- Custom npm registries and version pinning when installing plugins
- Managed settings via macOS plist or Windows Registry
- `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_USER_EMAIL`, `CLAUDE_CODE_ORGANIZATION_UUID` env vars for SDK
- `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` env var (default now 120s, was 30s)
- Tool results > 50K chars persisted to disk (was 100K)
- BashTool skips login shell by default when shell snapshot available
- Security fix: `statusLine` and `fileSuggestion` hook commands require workspace trust

### 2.1.50
- WorktreeCreate hook event (fires on worktree creation, receives `name` slug, must print worktree path to stdout)
- WorktreeRemove hook event (fires on worktree removal, receives `worktree_path`, cannot block)
- LSP `startupTimeout` configuration support
- `claude agents` CLI command (list all configured agents)
- 1M context window for Opus 4.6 fast mode
- `CLAUDE_CODE_SIMPLE` mode strips down to minimal experience
- Fix: custom agents/skills now discovered when running from a git worktree

### 2.1.49
- ConfigChange hook event (fired when Claude Code configuration is modified, matcher on config source)
- Background agents (`background: true` in agent frontmatter)
- Worktree isolation (`isolation: worktree` in agent frontmatter)

### 2.1.47
- `last_assistant_message` field in Stop/SubagentStop hook inputs

### 2.1.45
- Sonnet 4.6 model support

### 2.1.36
- Fast mode for Opus 4.6 (same model, faster output)

### 2.1.33
- TeammateIdle hook event (fired when a teammate agent goes idle)
- TaskCompleted hook event (fired when a task is marked completed)
- Agent `memory` frontmatter field (`project`, `session`, etc.)
- `Agent(agent_type)` restriction for spawning specific agent types (was `Task(agent_type)` before 2.1.63)

### 2.1.32
- Agent Teams (TeamCreate, SendMessage, multi-agent coordination)
- Opus 4.6 model support
- Automatic memories (persistent auto memory directory)

### 2.1.27
- PR linkage (`--from-pr` flag, auto-link on `gh pr create`)
- PR-linked sessions for resuming work from pull requests

### 2.1.20
- Task deletion (`status: "deleted"` in TaskUpdate)

### 2.1.16
- Task system overhaul with dependencies (blocks/blockedBy)
- TaskCreate, TaskUpdate, TaskGet, TaskList tools
- Task status workflow: pending → in_progress → completed

### 2.1.10
- Setup hook (`--init`, `--init-only`, `--maintenance` flags)
- Session slug (human-readable session names like "snug-dreaming-knuth")
- Token usage in messages (input_tokens, output_tokens, cache_read/creation_tokens)

### 2.0.x Features (Supported)
- All standard hooks (SessionStart, UserPromptSubmit, Stop, PreToolUse, PostToolUse, etc.)
- Progress messages with `parentToolUseID`
- Tool use/result correlation
- MCP tool calls
- Session summaries and compaction

## Complete Hook Events Reference (as of 2.1.63)

| Event | Matcher | Hook Types | Since |
|-------|---------|------------|-------|
| SessionStart | startup/resume/clear/compact | command only | 2.0.x |
| UserPromptSubmit | No | command, http, prompt, agent | 2.0.x |
| PreToolUse | tool name | command, http, prompt, agent | 2.0.x |
| PermissionRequest | tool name | command, http, prompt, agent | ~2.1.50 |
| PostToolUse | tool name | command, http, prompt, agent | 2.0.x |
| PostToolUseFailure | tool name | command, http, prompt, agent | ~2.1.50 |
| Notification | notification type | command only | 2.0.x |
| SubagentStart | agent type | command only | 2.0.x |
| SubagentStop | agent type | command, http, prompt, agent | 2.0.x |
| Stop | No | command, http, prompt, agent | 2.0.x |
| TeammateIdle | No | command only | 2.1.33 |
| TaskCompleted | No | command, http, prompt, agent | 2.1.33 |
| ConfigChange | config source | command only | 2.1.49 |
| WorktreeCreate | No | command only | 2.1.50 |
| WorktreeRemove | No | command only | 2.1.50 |
| PreCompact | manual/auto | command only | ~2.1.50 |
| SessionEnd | exit reason | command only | 2.0.x |

## Hook Types (as of 2.1.63)

| Type | Description | Since |
|------|-------------|-------|
| command | Execute shell command | 2.0.x |
| prompt | Return text to agent | 2.0.x |
| agent | Spawn agent hook | 2.1.x |
| http | POST JSON to URL, receive JSON response | 2.1.63 |

## Notes

- **Turn duration**: Calculated client-side, not in JSONL - no data to index
- **Context window usage**: Part of progress messages, extracted during indexing

## Update Process

When new Claude Code versions release:
1. Review changelog for new message types, hooks, or fields
2. Update han-native indexer for new fields
3. Update GraphQL schema as needed
4. Update website hook documentation
5. Bump version number above
