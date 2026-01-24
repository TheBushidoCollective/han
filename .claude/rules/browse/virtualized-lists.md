# Virtualized Lists (CRITICAL)

## NEVER Replace VirtualList with Simple map() Rendering

Paginated lists with potentially large datasets MUST use the `VirtualList` component (`@shopify/flash-list`).

### When VirtualList is REQUIRED

- **SessionMessages** - Can have hundreds/thousands of messages
- **SessionListPage** - Can have many sessions
- **Any paginated connection** from GraphQL with `first`/`after` pagination

### Existing Infrastructure

The codebase has VirtualList infrastructure - USE IT:

```typescript
// Components
import { VirtualList, ViewTypes } from '@/components/organisms';

// Layout helpers
import {
  createMessageListLayout,
  createSessionListLayout,
  ItemHeights
} from '@/lists/layouts';
```

### FORBIDDEN Pattern

```typescript
// NEVER DO THIS for paginated data:
{messageNodes.map((node, idx) => (
  <MessageCard key={node.id} ... />
))}
```

This causes:
- DOM bloat with thousands of elements
- Memory issues on long sessions
- Scroll performance degradation
- Layout thrashing

### REQUIRED Pattern

```typescript
<VirtualList
  data={messageNodes}
  renderItem={(item, index) => <MessageCard fragmentRef={item} />}
  itemHeight={ItemHeights.MESSAGE_ITEM}
  onEndReached={handleLoadMore}
  initialRenderIndex={0} // For newest-first data
  dynamicHeights={true} // Messages have variable height
/>
```

### Chat Log Specifics (SessionMessages)

For chat logs that need newest-at-bottom behavior:

1. Data comes newest-first from API (DESC order)
2. Use `initialRenderIndex={0}` to start at newest
3. `onEndReached` loads OLDER messages (scrolling down = back in time)
4. Combine with column-reverse container OR use inverted scroll props
5. See `chat-log-scroll.md` for scroll behavior rules

### Performance Thresholds

- < 50 items: map() acceptable but VirtualList preferred
- 50-200 items: VirtualList strongly recommended
- 200+ items: VirtualList MANDATORY

### If You Remove VirtualList

You will cause:
- Performance regression on real user data
- Memory leaks on long sessions
- UI freezing when loading history
- Weeks of optimization work deleted

**This infrastructure was built intentionally. Do not remove it.**
