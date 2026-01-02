# Test Feature Index

Complete index of all BDD test features for the Han browse-client.

## Statistics

- **Total Feature Files**: 16
- **Total Scenarios**: 90
- **Total Step Definitions**: 60+
- **Lines of Test Code**: ~3,500+

## Feature Files

### 1. cache.feature (3 scenarios)

Tests for the cache page functionality.

**Scenarios**:

- Cache page loads
- Cache page is accessible from navigation
- Project cache page loads

**Coverage**: Cache page, project-specific cache

---

### 2. dashboard-comprehensive.feature (11 scenarios)

Comprehensive dashboard tests covering all dashboard features.

**Scenarios**:

- Dashboard loads with all main elements
- Dashboard shows stats grid
- Dashboard shows recent sessions section
- Dashboard shows agent health section
- Dashboard shows plugin categories
- Click on projects stat navigates to projects
- Dashboard displays valid timestamps
- Project dashboard shows project-specific content
- Project dashboard shows resource cards
- Dashboard header displays correctly
- Live indicator shows on dashboard

**Coverage**: Stats grid, recent sessions, agent health, plugin categories, project resources, live updates, timestamps

---

### 3. dashboard.feature (3 scenarios)

Basic dashboard functionality tests.

**Scenarios**:

- Dashboard page loads
- Sessions display with valid timestamps
- Navigate to session detail

**Coverage**: Basic page load, timestamp validation, navigation

---

### 4. error-states.feature (4 scenarios)

Tests for error handling and edge cases.

**Scenarios**:

- Session not found shows error
- Invalid route shows error or redirects
- Empty states display appropriately
- Plugins page shows empty state

**Coverage**: Error messages, 404 handling, empty states

---

### 5. live-updates.feature (4 scenarios)

Tests for real-time WebSocket updates.

**Scenarios**:

- Dashboard shows live indicator
- Dashboard shows update timestamp
- Session detail supports live updates
- Sessions list supports subscriptions

**Coverage**: WebSocket subscriptions, live indicators, real-time data

---

### 6. memory.feature (8 scenarios)

Tests for memory search and navigation.

**Scenarios**:

- Memory page loads
- Memory page shows tab navigation
- Switch to Rules tab
- Switch to Search tab
- Memory shows scope filter
- Project memory page loads
- Search input is available
- Rules tab shows rules content

**Coverage**: Memory search, rules browsing, tab navigation, scope filtering

---

### 7. metrics.feature (6 scenarios)

Tests for metrics and performance data.

**Scenarios**:

- Metrics page loads
- Metrics page shows content
- Metrics display statistics
- Dashboard shows metrics summary
- Dashboard shows calibration score
- Navigate to metrics from dashboard

**Coverage**: Metrics page, statistics display, calibration, navigation

---

### 8. navigation.feature (8 scenarios)

Tests for cross-page navigation.

**Scenarios**:

- Navigate from dashboard to sessions
- Navigate from dashboard to projects
- Navigate from dashboard to plugins
- Navigate from dashboard to metrics
- Navigate from dashboard to memory
- Navigate from dashboard to cache
- Navigate from dashboard to settings
- Direct navigation to all main pages works

**Coverage**: All navigation paths, direct URL access

---

### 9. pages.feature (7 scenarios)

Basic page load tests for all main pages.

**Scenarios**:

- Plugins page loads
- Settings page loads
- Projects page loads
- Repos page loads
- Metrics page loads
- Memory page loads
- Cache page loads

**Coverage**: Basic page rendering for all routes

---

### 10. plugins.feature (10 scenarios)

Tests for plugin management functionality.

**Scenarios**:

- Plugins page loads
- Plugins page shows stats
- Plugin cards display
- Plugin cards link to han.guru
- Plugin search is available
- Filter plugins by scope
- Search for plugins
- Plugin installation hint is shown
- Plugin categories are displayed
- Navigate to project plugins

**Coverage**: Plugin listing, search, filtering, stats, external links, project-specific plugins

---

### 11. projects.feature (6 scenarios)

Tests for project and repository management.

**Scenarios**:

- Projects page loads
- Projects page shows repos list
- Project detail page loads
- Project detail shows sessions
- Project detail shows resource navigation
- Navigate to project sessions

**Coverage**: Project listing, project detail, sessions, resource navigation

---

### 12. rules.feature (5 scenarios)

Tests for rules browsing and search.

**Scenarios**:

- Rules tab is accessible
- Rules are displayed in memory page
- Search for rules
- Rules tab shows proper scope
- Project rules show project scope

**Coverage**: Rules display, search, scope filtering, project-specific rules

---

### 13. session-detail.feature (2 scenarios)

Basic session detail page tests.

**Scenarios**:

- Session detail page shows content
- Session timestamps are valid

**Coverage**: Session detail rendering, timestamp validation

---

### 14. session-messages.feature (6 scenarios)

Tests for session message display and navigation.

**Scenarios**:

- Session detail page shows messages
- Messages display with proper structure
- Session shows message count
- Session header displays project metadata
- Session shows summary if available
- Back button navigates to sessions list

**Coverage**: Message display, message structure, metadata, summary, navigation

---

### 15. session-ordering.feature (3 scenarios)

Tests for session list ordering.

**Scenarios**:

- Dashboard shows sessions in descending order
- Sessions list shows sessions in descending order
- Sessions are ordered consistently across views

**Coverage**: Session ordering, consistency across views

---

### 16. settings.feature (4 scenarios)

Tests for settings page functionality.

**Scenarios**:

- Settings page loads
- Global settings page is accessible
- Project settings page loads
- Settings page shows content

**Coverage**: Settings page, global settings, project settings

---

## Test Coverage Summary

### Pages Covered

- ✅ Dashboard (global and project-specific)
- ✅ Sessions list
- ✅ Session detail
- ✅ Projects/Repos list
- ✅ Project/Repo detail
- ✅ Plugins
- ✅ Memory
- ✅ Settings
- ✅ Metrics
- ✅ Cache

### Features Covered

- ✅ Navigation between all pages
- ✅ Session messages and ordering
- ✅ Memory search and rules
- ✅ Plugin management and filtering
- ✅ Statistics and metrics
- ✅ Live updates (WebSocket)
- ✅ Project-specific views
- ✅ Error handling
- ✅ Empty states
- ✅ Timestamp validation

### Data Integrity

- ✅ Valid timestamps (no epoch dates)
- ✅ Message counts
- ✅ Session metadata
- ✅ Project metadata
- ✅ Plugin statistics
- ✅ Metrics accuracy

### User Interactions

- ✅ Tab navigation
- ✅ Click navigation
- ✅ Back button navigation
- ✅ Search and filtering
- ✅ Resource card clicks

## Tag Distribution

### @requires-sessions

Used by tests that need existing session data:

- session-detail.feature (2 scenarios)
- session-messages.feature (6 scenarios)
- session-ordering.feature (3 scenarios)
- live-updates.feature (4 scenarios)
- dashboard.feature (1 scenario)

**Total**: ~16 scenarios

### @requires-data

Used by tests that need general data:

- dashboard-comprehensive.feature (9 scenarios)
- projects.feature (4 scenarios)
- plugins.feature (5 scenarios)
- memory.feature (1 scenario)
- metrics.feature (5 scenarios)
- cache.feature (1 scenario)

**Total**: ~25 scenarios

### No tags

Tests that work with empty state:

- All basic page load tests
- Navigation tests
- Error state tests
- ~49 scenarios

## Running Tests by Feature

### Core Functionality

```bash
npx playwright test dashboard session-messages session-ordering
```

### Data Management

```bash
npx playwright test memory rules cache
```

### Configuration

```bash
npx playwright test plugins settings
```

### Monitoring

```bash
npx playwright test metrics live-updates
```

### Navigation & UX

```bash
npx playwright test navigation error-states pages
```

## Test Maintenance

### When UI Changes

1. Update affected step definitions in `steps.ts`
2. Re-run `npx bddgen`
3. Run affected tests
4. Update this index if scenarios change

### When Adding Features

1. Create new `.feature` file
2. Use existing step definitions
3. Add new steps to `steps.ts` only if needed
4. Run `npx bddgen`
5. Update this index

### When Refactoring

1. Run full suite before changes
2. Make incremental changes
3. Run tests after each change
4. Update documentation

## Quick Reference

### Most Comprehensive Tests

- `dashboard-comprehensive.feature` - Full dashboard coverage
- `plugins.feature` - Complete plugin management
- `memory.feature` - Memory and rules coverage
- `session-messages.feature` - Session detail coverage

### Critical Path Tests

- `dashboard.feature` - Basic dashboard
- `session-detail.feature` - Session viewing
- `navigation.feature` - Page navigation
- `pages.feature` - Basic page loads

### Edge Case Tests

- `error-states.feature` - Error handling
- `live-updates.feature` - Real-time features

## Metrics

### Test Distribution

- **Dashboard**: 14 scenarios (16%)
- **Sessions**: 11 scenarios (12%)
- **Plugins**: 10 scenarios (11%)
- **Navigation**: 8 scenarios (9%)
- **Memory**: 8 scenarios (9%)
- **Metrics**: 6 scenarios (7%)
- **Projects**: 6 scenarios (7%)
- **Rules**: 5 scenarios (6%)
- **Settings**: 4 scenarios (4%)
- **Live Updates**: 4 scenarios (4%)
- **Error States**: 4 scenarios (4%)
- **Cache**: 3 scenarios (3%)
- **Pages**: 7 scenarios (8%)

### Estimated Execution Time

- **Single test**: ~5-10 seconds
- **Single feature**: ~30-60 seconds
- **Full suite (parallel)**: ~5-15 minutes
- **Full suite (serial)**: ~15-30 minutes

## Files Reference

### Test Files

- `tests/features/*.feature` - Feature files (Gherkin)
- `tests/features/steps.ts` - Step definitions
- `.features-gen/tests/features/*.spec.js` - Generated tests

### Documentation

- `tests/features/README.md` - Feature writing guide
- `tests/TEST_SUMMARY.md` - Test suite overview
- `tests/TESTING_GUIDE.md` - Complete testing guide
- `tests/features/INDEX.md` - This file

### Configuration

- `playwright.config.ts` - Playwright configuration
- `package.json` - Test scripts and dependencies

## Contributing

When contributing new tests:

1. **Check existing features** - Avoid duplication
2. **Use existing steps** - Check `steps.ts` first
3. **Follow patterns** - Look at similar feature files
4. **Tag appropriately** - Add `@requires-*` tags
5. **Update index** - Add your feature to this file
6. **Run tests** - Verify they pass

## Resources

- [Feature README](./README.md) - How to write features
- [Testing Guide](../TESTING_GUIDE.md) - How to run tests
- [Test Summary](../TEST_SUMMARY.md) - Suite overview
- [Step Definitions](./steps.ts) - Available steps

---

**Last Updated**: December 23, 2024
**Total Scenarios**: 90
**Total Features**: 16
**Coverage**: Comprehensive
