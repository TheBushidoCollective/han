# Claude Code Feature Support

Han maintains feature parity with Claude Code releases. This file tracks which version we support.

## Current Support Level

**Supported up to:** Claude Code 2.1.10

## Features Tracked

### 2.1.10 (Current)
- Setup hook (`--init`, `--init-only`, `--maintenance` flags)
- Session slug (human-readable session names like "snug-dreaming-knuth")
- Token usage in messages (input_tokens, output_tokens, cache_read/creation_tokens)

### 2.0.x Features (Supported)
- All standard hooks (SessionStart, UserPromptSubmit, Stop, PreToolUse, PostToolUse, etc.)
- Progress messages with `parentToolUseID`
- Tool use/result correlation
- MCP tool calls
- Session summaries and compaction

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
