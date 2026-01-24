---
name: hook-result-parent-linkage
summary: Hook result messages need parent_id linkage to hook run messages
---

# Hook Result Parent Linkage

## Problem

Hook result messages are appearing as separate timeline items instead of being nested under their parent hook run message.

## Current State

1. **Database schema** has `parent_id` column on messages table
2. **Server filtering** already skips messages with `parentId` when publishing to subscriptions (coordinator/server.ts:279-282)
3. **GraphQL types**:
   - `HookRunMessage` has a `result` field that loads via DataLoader using `hookRunId`
   - `HookResultMessage` exists as a separate type
   - Both have `hookRunId` UUID for correlation
4. **Issue**: Hook result messages have `parent_id = NULL` in database

## Root Cause

The Rust indexer (`han-native/src/indexer.rs`) doesn't set `parent_id` when indexing `hook_result` events.

## Solution

Modify the indexer to:

1. When indexing a `han_event` with `toolName="hook_result"`:
   - Extract `hookRunId` from the event content
   - Query for the hook_run message with matching `hookRunId` in its raw_json
   - Set `parent_id` to the hook_run message's `id`

2. Similar pattern already exists for:
   - Tool results (mcp_tool_result, exposed_tool_result) linking to tool calls
   - These use `callId` for correlation

## Files to Modify

### han-native/src/indexer.rs

```rust
// When processing han_event with toolName="hook_result":
if tool_name == Some("hook_result") {
    // Extract hookRunId from content
    let hook_run_id = extract_hook_run_id_from_content(&content)?;
    
    // Find the hook_run message with this hookRunId
    let parent_id = find_message_by_hook_run_id(conn, session_id, &hook_run_id)?;
    
    // Set parent_id when creating MessageInput
    message_input.parent_id = parent_id;
}
```

### han-native/src/crud.rs

Add helper function:

```rust
pub fn find_message_by_hook_run_id(
    conn: &Connection,
    session_id: &str,
    hook_run_id: &str,
) -> Result<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM messages 
         WHERE session_id = ?1 
         AND message_type = 'han_event' 
         AND tool_name = 'hook_run' 
         AND json_extract(raw_json, '$.content.hookRunId') = ?2"
    )?;
    
    let result = stmt.query_row(params![session_id, hook_run_id], |row| {
        row.get::<_, String>(0)
    }).optional()?;
    
    Ok(result)
}
```

## Testing

1. Run a hook and verify:
   - Hook run message appears in timeline
   - Hook result does NOT appear in timeline
   - Hook run message has `.result` field populated
2. Check database:

   ```sql
   SELECT id, parent_id, tool_name FROM messages
   WHERE tool_name IN ('hook_run', 'hook_result')
   ORDER BY timestamp;
   ```

   - hook_result rows should have parent_id = hook_run message id

## Related

- `.claude/rules/graphql/message-types.md` - Documents that result messages should not appear in timeline
- Tool results (MCP, exposed) already use this pattern with `callId`
