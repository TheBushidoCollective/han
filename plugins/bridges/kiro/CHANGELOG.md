# Changelog

## 0.1.0 (2026-02-08)

### Added

- Initial release of the Kiro CLI bridge plugin
- CLI entry point (`kiro-plugin-han`) callable by Kiro agent hooks
- Hook event mapping: agentSpawn, userPromptSubmit, preToolUse, postToolUse, stop
- Kiro tool name mapping (fs_write -> Write, execute_bash -> Bash, etc.)
- PreToolUse blocking via exit code 2 (Kiro convention)
- PostToolUse per-file validation with parallel hook execution
- Stop hooks for full project validation
- SessionStart context injection (core guidelines)
- UserPromptSubmit datetime injection
- Content-hash caching for hook execution
- JSONL event logging with provider="kiro" for Browse UI visibility
- Example Kiro agent config (kiro-agent.json)
- Plugin/hook discovery from installed Han plugins
