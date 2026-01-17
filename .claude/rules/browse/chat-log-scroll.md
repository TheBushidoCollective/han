# Chat Log Scroll Behavior (CRITICAL)

**See also: `virtualized-lists.md` - SessionMessages MUST use VirtualList**

## NEVER REMOVE inverted={true} from SessionMessages

The `SessionMessages.tsx` component MUST use `inverted={true}` on VirtualList for proper chat UX.

### Why This Is Critical

Chat logs (like iMessage, Slack, Discord) have a specific UX pattern:
- New messages appear at the **bottom**
- User starts scrolled to the **bottom** (seeing newest)
- Scrolling **up** shows older messages

### FlashList inverted Behavior

```tsx
<VirtualList
  inverted={true}
  maintainVisibleContentPosition={{
    startRenderingFromBottom: true,
    autoscrollToBottomThreshold: 100,
  }}
/>
```

This configuration:
- Renders content starting from the bottom
- Auto-scrolls to bottom when near threshold and new content arrives
- Maintains scroll position when loading older messages

### FORBIDDEN Actions

1. **NEVER** remove `inverted={true}` from SessionMessages VirtualList
2. **NEVER** use `.reverse()` on messageNodes - FlashList handles visual order
3. **NEVER** remove `maintainVisibleContentPosition` configuration

### Data Flow

1. API returns messages DESC (newest first)
2. Relay connection stores `[newest, ..., oldest]`
3. VirtualList with `inverted` displays as `[oldest at top, newest at bottom]`
4. New messages prepend to connection = appear at visual bottom
5. `autoscrollToBottomThreshold` auto-scrolls when new messages arrive

### If You Break This

You will break the entire chat log UX. Users will:
- Start at the top instead of bottom
- See oldest messages first instead of newest
- Have inverted scroll behavior
- Lose their scroll position constantly

**This is a fundamental chat UX pattern. Do not change it.**
