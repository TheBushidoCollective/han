---
status: completed
depends_on: []
branch: ai-dlc/browse-dashboard-overhaul/03-bug-fixes-polish
discipline: frontend
ticket: ""
---

# unit-03: Bug Fixes & Polish

## Description

Fix 5 bugs discovered during dashboard exploration that degrade the browse experience: connection overlay flash, react-native-web text node violations, missing 404 page, stale Relay artifact, and missing session list sorting.

## Discipline

frontend - This unit will be executed by `do-frontend-development` specialized agents.

## Domain Entities

- **ConnectionGate**: Manages WebSocket connection state (connected, disconnected, transitioning)
- **ConnectionOverlay**: Renders connection status UI
- **Route**: Vite-plugin-pages generated routes
- **Session**: sortable fields (createdAt, estimatedCostUsd, turnCount, duration)

## Data Sources

No new data sources needed. All fixes are frontend logic and rendering changes.

## Technical Specification

### Fix 1: Connection Overlay Flash

**File:** `packages/browse-client/src/components/organisms/ConnectionGate.tsx` (lines 79-99)

**Problem:** The ConnectionGate component renders a `ConnectionOverlay` during the "transitioning" phase with an opacity animation. When navigating between pages while already connected, the connection briefly enters "transitioning" state, causing the overlay to flash visibly before fading out.

**Fix:** Skip rendering the ConnectionOverlay when the connection is already established and the transition is from connected → connected (page navigation). The overlay should only appear when genuinely disconnected or connecting for the first time.

Approach options (builder should evaluate which is cleanest):
1. Track `previousConnectionState` and suppress overlay when transitioning from `connected`
2. Add a debounce/delay before showing overlay (e.g., only show if transitioning persists > 500ms)
3. Remove the transitioning render phase entirely — go directly from disconnected → connected without overlay

### Fix 2: React-Native-Web Text Node Warnings

**Files:**
- `packages/browse-client/src/components/organisms/ConnectionOverlay.tsx` (lines 164-165)
- `packages/browse-client/src/components/pages/PluginListPage/index.tsx` (lines 431-433)

**Problem:** React-native-web requires all text to be inside `<Text>` components. Bare string nodes like `"or"` or mixed text+JSX children produce console warnings: "Unexpected text node: [text]. A text node cannot be a child of a <View>."

**Fix:** Wrap all bare text nodes in `<Text>` components.

For ConnectionOverlay.tsx (~line 164-165):
```tsx
// Before (causes warning):
<Box>... or ...</Box>

// After:
<Box><Text>or</Text></Box>
```

For PluginListPage/index.tsx (~lines 431-433):
```tsx
// Before (causes warning):
<Box>Some text {variable} more text</Box>

// After:
<Box><Text>Some text {variable} more text</Text></Box>
```

**Verification:** After fixing, check browser console for any remaining "Unexpected text node" warnings. There should be zero.

### Fix 3: 404 Not Found Page

**Files:**
- `packages/browse-client/src/App.tsx` (lines 108-124)
- Potentially `packages/browse-client/vite.config.ts` (route generation)
- New file: `packages/browse-client/src/components/pages/NotFoundPage.tsx` (or similar)

**Problem:** Navigating to an invalid route (e.g., `/nonexistent-page`) renders a blank content area with only the sidebar visible. There is no 404 page or redirect.

**Fix:**
1. Create a `NotFoundPage` component using existing atoms (Box, VStack, Heading, Text, Button/Link)
2. Display: "Page Not Found" heading, brief message, and a link back to the dashboard
3. In `App.tsx`, handle the case where `useRoutes(routes)` returns `null` by rendering the NotFoundPage component
4. Alternatively, add a catch-all route (`*` or `[...all]`) to the vite-plugin-pages route configuration

**Component pattern:** Follow atomic design — use existing atoms only, no HTML tags. Example:
```tsx
<VStack style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <Heading size="xl">Page Not Found</Heading>
  <Text>The page you're looking for doesn't exist.</Text>
  <Link href="/">Back to Dashboard</Link>
</VStack>
```

### Fix 4: Stale PluginListPageToggleMutation Relay Artifact

**File:** `packages/browse-client/src/components/pages/PluginListPage/index.tsx` (line ~20)

**Problem:** The PluginListPage imports a Relay mutation artifact (`PluginListPageToggleMutation`) that may be stale or not regenerated. This produces a console warning about stale definitions.

**Fix:** Run the Relay compiler to regenerate artifacts:
```bash
cd packages/browse-client && npx relay-compiler
```

If the mutation definition has changed or been removed from the GraphQL schema, update the component to match the current schema or remove the unused mutation import.

**Verification:** After regeneration, confirm no Relay stale definition warnings in the console.

### Fix 5: Session List Sorting

**File:** `packages/browse-client/src/components/pages/SessionListPage/index.tsx`

**Problem:** The sessions list page shows 1475+ sessions but has no way to sort them. Users can only view them in the default order (likely most recent first).

**Fix:** Add a sort dropdown above the session list with these options:
- **Most Recent** (default) - Sort by createdAt DESC
- **Oldest First** - Sort by createdAt ASC
- **Highest Cost** - Sort by estimatedCostUsd DESC
- **Most Turns** - Sort by turnCount DESC
- **Longest Duration** - Sort by duration DESC

**Implementation:**
1. Add a sort state variable: `const [orderBy, setOrderBy] = useState<SessionOrderBy>({ createdAt: 'DESC' })`
2. Pass the `orderBy` parameter to the sessions connection query (GreenFairy pattern: the `sessions` connection already accepts `orderBy: SessionOrderBy`)
3. Render a dropdown/picker using existing atoms (Pressable + menu pattern or a simple HStack of sort buttons)
4. When sort changes, refetch the query with the new orderBy

**UI pattern:** Place the sort control in an HStack above the session list, next to the existing search/filter controls (if any). Use `<Text>` for labels, `<Pressable>` for sort option buttons, or a dropdown molecule if one exists.

## Success Criteria

- [ ] Connection overlay does not flash/appear on page navigations when already connected
- [ ] No "Unexpected text node" console errors from react-native-web
- [ ] Invalid routes display a 404 Not Found page with navigation back to dashboard
- [ ] PluginListPageToggleMutation relay artifact is regenerated (no stale definition warning)
- [ ] Sessions list page supports sorting by date, cost, turns, and duration
- [ ] All existing Playwright BDD tests continue to pass
- [ ] No TypeScript errors (`bun run typecheck` passes)

## Risks

- **ConnectionGate state machine complexity**: The connection state management may have edge cases (reconnection after sleep, WebSocket drops). Mitigation: Test the fix with actual page navigation, not just reading the code. Ensure reconnection still works.
- **Relay compiler version mismatch**: Running relay-compiler may regenerate artifacts with version differences. Mitigation: Use the same relay-compiler version already in package.json devDependencies.
- **SessionOrderBy type**: The GreenFairy-generated `SessionOrderBy` input may not include all fields needed for sorting. Mitigation: Check the GraphQL schema for available sort fields before implementing.

## Boundaries

This unit does NOT:
- Modify the Session Detail page (unit-01)
- Modify the Project Detail page (unit-02)
- Add responsive/mobile layout (deferred)
- Fix the Plugins page, Cache page, Memory page, or Settings page (deferred)
- Add new backend GraphQL resolvers or fields

## Notes

- Fix 1 (connection overlay) is the most impactful UX improvement — it affects every page navigation
- Fix 2 (text nodes) is trivial but important for clean console output
- Fix 3 (404 page) is straightforward — create one component and wire it up
- Fix 4 (relay artifact) may be a one-command fix (`npx relay-compiler`)
- Fix 5 (sorting) requires understanding the GreenFairy `orderBy` pattern — check `SessionOrderBy` in the GraphQL schema
- Run `bun run typecheck` and all Playwright BDD tests after all fixes to verify no regressions
