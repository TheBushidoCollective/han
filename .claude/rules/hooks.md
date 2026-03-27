# Han Hook Architecture

## Hook Types and Logging

- **SessionStart/UserPromptSubmit hooks**: Inject context information via `han hook dispatch`. These should NOT write to the han events log - they just output text.

- **Stop hooks**: Run `han hook run ...` commands. These SHOULD write to the han events log file (`{date}-{sessionId}-han.jsonl`).

## Key Distinction

- `han hook dispatch` - Dispatches hook execution, outputs text
- `han hook run` - Executes individual hooks with caching/validation, should log events
