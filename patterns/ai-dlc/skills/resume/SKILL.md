---
description: Resume work on an existing AI-DLC intent when ephemeral state is lost
disable-model-invocation: true
argument-hint: "[intent-slug]"
---

## Name

`ai-dlc:resume` - Resume an existing AI-DLC intent.

## Synopsis

```
/resume [intent-slug]
```

## Description

**User-facing command** - Resume work on an intent when ephemeral state (iteration.json) is lost but `.ai-dlc/` artifacts exist.

This happens when:
- Session context was cleared unexpectedly
- Starting fresh session after previous work
- Branch state lost but artifacts preserved

**User Flow:**
```
SessionStart: "Resumable Intents Found: my-feature"
User: /resume my-feature
AI: Initialized state, continuing as builder...
User: /construct
...continues work...
```

## Implementation

### Step 1: Find Resumable Intents

If no slug provided, scan multiple sources for active intents:

**A: Check filesystem first (highest priority - source of truth):**

```bash
for intent_file in .ai-dlc/*/intent.md; do
  [ -f "$intent_file" ] || continue
  dir=$(dirname "$intent_file")
  slug=$(basename "$dir")
  status=$(han parse yaml status -r --default active < "$intent_file")
  [ "$status" = "active" ] && echo "$slug"
done
```

**B: Check git branches using `discover_branch_intents`:**

```bash
# Source DAG library
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Discover from branches (include remote for resume command)
branch_intents=$(discover_branch_intents true)

# Parse results: slug|workflow|source|branch
echo "$branch_intents" | while IFS='|' read -r slug workflow source branch; do
  [ -z "$slug" ] && continue
  echo "$slug ($source: $branch)"
done
```

**Selection logic:**
- 1 intent found -> auto-select
- Multiple intents -> list them and prompt user to specify
- 0 intents -> error, suggest `/elaborate`

### Step 2: Load Intent Metadata

Read from `.ai-dlc/{slug}/intent.md`:

```javascript
const intentFile = `.ai-dlc/${slug}/intent.md`;
const workflow = han_parse_yaml(intentFile, "workflow") || "default";
const title = han_parse_yaml(intentFile, "title") || slug;
```

### Step 3: Determine Starting Hat

Use DAG analysis to determine where to resume:

```bash
# Source DAG library
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Get recommended hat based on unit states
starting_hat=$(get_recommended_hat ".ai-dlc/${slug}" "${workflow}")
```

**Hat selection logic:**
- No units exist -> `planner` (needs decomposition)
- All units completed -> `reviewer` (final verification)
- Any units in_progress or ready -> `builder` (continue work)
- All units blocked -> `planner` (resolve dependencies)

### Step 4: Create Intent Worktree

**CRITICAL: The orchestrator MUST run in the intent worktree, not the main working directory.**

```bash
INTENT_BRANCH="ai-dlc/${slug}"
INTENT_WORKTREE="/tmp/ai-dlc-${slug}"

if [ ! -d "$INTENT_WORKTREE" ]; then
  git worktree add -B "$INTENT_BRANCH" "$INTENT_WORKTREE"
fi
cd "$INTENT_WORKTREE"
```

### Step 5: Initialize State

Save to han keep storage (intent-level state goes to current branch, which is now the intent branch):

```javascript
// Save intent slug (intent-level state -> current branch / intent branch)
han_keep_save({ scope: "branch", key: "intent-slug", content: slug });

// Save iteration state (intent-level state -> current branch / intent branch)
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify({
    iteration: 1,
    hat: startingHat,
    workflowName: workflow,
    workflow: workflowHats,
    status: "active"
  })
});
```

### Step 6: Output Confirmation

```markdown
## AI-DLC Intent Resumed

**Intent:** {title}
**Slug:** {slug}
**Workflow:** {workflow}
**Starting Hat:** {startingHat}
**Worktree:** /tmp/ai-dlc-{slug}/

### Unit Status
{get_dag_status_table output}

**Summary:** {completed}/{total} units completed

**Next:** Run `/construct` to continue the construction loop.

Note: All AI-DLC work happens in the worktree at /tmp/ai-dlc-{slug}/
```

## Examples

### Single Intent (Auto-Select)

```
User: /resume
AI: Found 1 resumable intent: han-team-platform

## AI-DLC Intent Resumed

**Intent:** Han Team Platform
**Slug:** han-team-platform
**Workflow:** default
**Starting Hat:** builder
**Worktree:** /tmp/ai-dlc-han-team-platform/

### Unit Status
| Unit | Status | Blocked By |
|------|--------|------------|
| unit-01-core-setup | completed | |
| unit-02-auth | in_progress | |
| unit-03-dashboard | pending | unit-02-auth |

**Summary:** 1/3 units completed

**Next:** Run `/construct` to continue the construction loop.
```

### Multiple Intents (Requires Selection)

```
User: /resume
AI: Found multiple resumable intents:
- han-team-platform (default workflow, 1/3 completed)
- api-refactor (tdd workflow, 0/5 completed)

Please specify: `/resume han-team-platform` or `/resume api-refactor`
```
