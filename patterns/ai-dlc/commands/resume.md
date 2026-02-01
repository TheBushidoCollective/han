---
description: Resume work on an existing AI-DLC intent when ephemeral state is lost
---

## Name

`jutsu-ai-dlc:resume` - Resume an existing AI-DLC intent.

## Synopsis

```
/resume [intent-slug]
```

## Description

**User-facing command** - Resume work on an intent when ephemeral state (iteration.json) is lost but `.ai-dlc/` artifacts exist.

This happens when:
- Session context was cleared without proper `/advance` or `/done`
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

If no slug provided, scan `.ai-dlc/*/intent.md` for active intents:

```bash
for intent_file in .ai-dlc/*/intent.md; do
  [ -f "$intent_file" ] || continue
  dir=$(dirname "$intent_file")
  slug=$(basename "$dir")
  status=$(han parse yaml status -r --default active < "$intent_file")
  [ "$status" = "active" ] && echo "$slug"
done
```

**Selection logic:**
- 1 intent found → auto-select
- Multiple intents → list them and prompt user to specify
- 0 intents → error, suggest `/elaborate`

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
- No units exist → `planner` (needs decomposition)
- All units completed → `reviewer` (final verification)
- Any units in_progress or ready → `builder` (continue work)
- All units blocked → `planner` (resolve dependencies)

### Step 4: Switch to Intent Worktree

**CRITICAL: The orchestrator MUST run in the intent worktree, not the main working directory.**

```bash
# Create or switch to intent worktree
INTENT_BRANCH="ai-dlc/${slug}"
INTENT_WORKTREE="/tmp/ai-dlc-${slug}"

# Create worktree if it doesn't exist
if [ ! -d "$INTENT_WORKTREE" ]; then
  git worktree add -B "$INTENT_BRANCH" "$INTENT_WORKTREE"
fi

# Switch to the intent worktree
cd "$INTENT_WORKTREE"
```

This ensures:
- Main working directory stays on `main`, unaffected
- All subsequent `han keep` operations use the intent branch's storage
- State is properly scoped to this intent
- Multiple intents can run in parallel in separate worktrees

### Step 5: Get Workflow Hats Array

Load the workflow definition:

```bash
hats_file="${CLAUDE_PLUGIN_ROOT}/workflows.yml"
workflow_hats=$(han parse yaml "${workflow}.hats" < "$hats_file" 2>/dev/null)
# Convert to JSON array: ["elaborator", "planner", "builder", "reviewer"]
```

### Step 6: Initialize State

Save to han keep storage (intent-level state goes to current branch, which is now the intent branch):

```javascript
// Save intent slug (intent-level state → current branch / intent branch)
han_keep_save({ scope: "branch", key: "intent-slug", content: slug });

// Save iteration state (intent-level state → current branch / intent branch)
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify({
    iteration: 1,
    hat: startingHat,
    workflowName: workflow,
    workflow: workflowHats,  // e.g., ["elaborator", "planner", "builder", "reviewer"]
    status: "active"
  })
});
```

### Step 7: Load Intent Content

Load and display the intent for context (save to current branch / intent branch):

```javascript
const intentContent = Read(`.ai-dlc/${slug}/intent.md`);
// Intent-level state → current branch (intent branch)
han_keep_save({ scope: "branch", key: "intent.md", content: intentContent });

// Also load completion criteria if exists
const criteriaFile = `.ai-dlc/${slug}/completion-criteria.md`;
if (fileExists(criteriaFile)) {
  const criteria = Read(criteriaFile);
  // Intent-level state → current branch (intent branch)
  han_keep_save({ scope: "branch", key: "completion-criteria.md", content: criteria });
}
```

### Step 8: Output Confirmation

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

### Specific Intent

```
User: /resume api-refactor
AI: ## AI-DLC Intent Resumed
...
```

## Error Cases

**No intents found:**
```
No resumable intents found in .ai-dlc/

To start a new task, run `/elaborate`.
```

**Intent not found:**
```
Intent 'nonexistent' not found in .ai-dlc/

Available intents:
- han-team-platform
- api-refactor

Run `/resume <slug>` with a valid slug.
```

**Already active:**
```
AI-DLC state already exists for this branch.

Current intent: han-team-platform
Current hat: builder

Run `/construct` to continue, or `/reset` to start fresh.
```
