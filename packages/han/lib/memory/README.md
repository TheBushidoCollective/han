# Han Memory System

A three-layer memory architecture for personal session continuity and team knowledge sharing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Permanent Wisdom (.claude/rules/)                     │
│  ─────────────────────────────────────                          │
│  Git-tracked, team-reviewed conventions                         │
│  Always loaded, highest authority                               │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Team Memory (authoritative sources)                   │
│  ─────────────────────────────────────                          │
│  Git commits, PRs, Issues, Reviews                              │
│  Researched on-demand, cached in LanceDB                        │
│  "Who knows X?" → Research until confident                      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Personal Memory (local sessions)                      │
│  ─────────────────────────────────────                          │
│  Session capture, AI summaries, continuity                      │
│  "What was I working on?" → Check recent sessions               │
└─────────────────────────────────────────────────────────────────┘
```

## Personal Memory (Layer 1)

### Session Flow

1. **Capture (PostToolUse hook)**: Records tool usage as observations
2. **Summarize (Stop hook)**: Generates session summary when session ends
3. **Context (SessionStart hook)**: Injects recent session context

### Stop Hook: Session Summarization

The Stop hook creates structured summaries from raw observations using pattern extraction (no AI required for basic version).

#### What it extracts

- **Work Items**: Completed tasks from file modifications
- **In Progress**: Work started but not finished (reads without edits)
- **Decisions**: Choices made (research followed by implementation)

#### Example

```typescript
import { summarizeSession, getMemoryStore } from "@thebushidocollective/han/memory";

const store = getMemoryStore();
const summary = summarizeSession(sessionId, store, { autoStore: true });

// summary = {
//   session_id: "abc123",
//   project: "my-app",
//   started_at: 1234567890,
//   ended_at: 1234567999,
//   summary: "Worked on authentication, testing",
//   work_items: [
//     {
//       description: "Implemented auth with tests",
//       files: ["src/auth/jwt.ts", "test/auth/jwt.test.ts"],
//       outcome: "completed"
//     }
//   ],
//   in_progress: ["Investigating payments"],
//   decisions: [
//     {
//       description: "Chose JWT approach",
//       rationale: "Found authentication comparison articles"
//     }
//   ]
// }
```

#### CLI Command

```bash
# Called from Stop hook
han memory session-end --session-id abc123

# Output:
# {
#   "success": true,
#   "session_id": "abc123",
#   "summary": {
#     "work_items": 2,
#     "in_progress": 1,
#     "decisions": 1
#   }
# }
```

### Pattern Extraction (No AI)

The summarization uses heuristics to extract patterns:

**Work Items**:

- Groups related file modifications (e.g., component + styles + test)
- Infers outcome from subsequent test results
- Marks as `partial` if errors detected, `completed` otherwise

**In Progress**:

- Identifies consecutive reads in same area without corresponding edits
- Detects blocked work from "not found" or error messages

**Decisions**:

- Finds research (WebSearch, Read) followed by implementation (Write, Edit)
- Extracts technical terms (JWT, OAuth, GraphQL, etc.)

**Summary Text**:

- Extracts key topics from work items
- Groups by area (authentication, payments, UI components, etc.)

### Storage

All personal memory stored in `~/.claude/han/memory/personal/`:

```
~/.claude/han/memory/personal/
  sessions/
    2025-12-12-abc123.jsonl    # Raw observations (append-only)
  summaries/
    2025-12-12-abc123.yaml     # Session summary
  .index/                       # Vector search index (future)
```

## Testing

```bash
# Unit tests
bun test test/memory-summarize.test.ts

# Integration tests
bun test test/memory-integration.test.ts

# All memory tests
bun test test/memory*.test.ts
```

## Future Enhancements

- AI-powered summarization (optional, using local models)
- Semantic search with embeddings
- Cross-session pattern detection
- Automatic promotion to .claude/rules/
