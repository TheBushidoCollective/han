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

### Step 4: Find Intent Source and Create Worktree

The intent may exist in three locations. Check in priority order:

**A: Intent in Filesystem (highest priority)**
```bash
INTENT_DIR=".ai-dlc/${slug}"
if [ -d "$INTENT_DIR" ]; then
  # Intent exists locally, use standard worktree creation
  INTENT_BRANCH="ai-dlc/${slug}"
  INTENT_WORKTREE="/tmp/ai-dlc-${slug}"

  if [ ! -d "$INTENT_WORKTREE" ]; then
    git worktree add -B "$INTENT_BRANCH" "$INTENT_WORKTREE"
  fi
  cd "$INTENT_WORKTREE"
fi
```

**B: Intent on Local Branch (no worktree)**
```bash
INTENT_BRANCH="ai-dlc/${slug}"
if git rev-parse --verify "$INTENT_BRANCH" &>/dev/null; then
  INTENT_WORKTREE="/tmp/ai-dlc-${slug}"

  # Create worktree from existing branch
  if [ ! -d "$INTENT_WORKTREE" ]; then
    git worktree add "$INTENT_WORKTREE" "$INTENT_BRANCH"
  fi
  cd "$INTENT_WORKTREE"
fi
```

**C: Intent on Remote Branch Only**
```bash
REMOTE_BRANCH="origin/ai-dlc/${slug}"
if git rev-parse --verify "$REMOTE_BRANCH" &>/dev/null; then
  INTENT_WORKTREE="/tmp/ai-dlc-${slug}"
  LOCAL_BRANCH="ai-dlc/${slug}"

  # Fetch and create local tracking branch
  git fetch origin "ai-dlc/${slug}:ai-dlc/${slug}" 2>/dev/null || true

  # Create worktree from the now-local branch
  if [ ! -d "$INTENT_WORKTREE" ]; then
    git worktree add "$INTENT_WORKTREE" "$LOCAL_BRANCH"
  fi
  cd "$INTENT_WORKTREE"
fi
```

**Combined Discovery Logic:**
```bash
# Source DAG library for branch discovery
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Find intent source
INTENT_SOURCE=""
INTENT_BRANCH=""

# Check filesystem first
if [ -d ".ai-dlc/${slug}" ]; then
  INTENT_SOURCE="filesystem"
  INTENT_BRANCH="ai-dlc/${slug}"
# Check local branch
elif git rev-parse --verify "ai-dlc/${slug}" &>/dev/null; then
  INTENT_SOURCE="local"
  INTENT_BRANCH="ai-dlc/${slug}"
# Check remote branch
elif git rev-parse --verify "origin/ai-dlc/${slug}" &>/dev/null; then
  INTENT_SOURCE="remote"
  INTENT_BRANCH="ai-dlc/${slug}"
  # Fetch to create local branch
  git fetch origin "ai-dlc/${slug}:ai-dlc/${slug}" 2>/dev/null
fi

if [ -z "$INTENT_SOURCE" ]; then
  echo "Error: Intent '${slug}' not found in filesystem, local branches, or remote"
  exit 1
fi

# Create/switch to worktree
INTENT_WORKTREE="/tmp/ai-dlc-${slug}"
if [ ! -d "$INTENT_WORKTREE" ]; then
  if [ "$INTENT_SOURCE" = "filesystem" ]; then
    git worktree add -B "$INTENT_BRANCH" "$INTENT_WORKTREE"
  else
    git worktree add "$INTENT_WORKTREE" "$INTENT_BRANCH"
  fi
fi
cd "$INTENT_WORKTREE"
```

**CRITICAL: The orchestrator MUST run in the intent worktree, not the main working directory.**

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
