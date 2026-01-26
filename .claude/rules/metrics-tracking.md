# Task Tracking (Automatic)

Task tracking is now **automatic** via Claude Code's built-in TaskCreate/TaskUpdate tools.

## How It Works

When you use the native task tools:
- `TaskCreate` - Creates a new task
- `TaskUpdate` - Updates task status (pending → in_progress → completed)
- `TaskList` - Lists all tasks
- `TaskGet` - Gets task details

Han automatically indexes these events from the JSONL transcript and displays them in the Browse UI.

## No Manual MCP Calls Needed

You do NOT need to call the legacy MCP metrics tools (`start_task`, `complete_task`). Just use Claude Code's built-in task system naturally.

## When to Use Tasks

Use TaskCreate for substantive work:
- Implementing features
- Fixing bugs
- Refactoring code
- Research tasks

Skip for trivial operations like reading files or answering simple questions.

## Viewing Task History

Task data is visible in the Browse UI sidebar under the "Tasks" tab for each session.
