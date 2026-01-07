# Date Handling Best Practices

## Using the Current Date

- **ALWAYS** use the injected current date when making temporal assertions
- Never assume or guess the current date based on training data
- Reference the current date explicitly when discussing "today", "this week", etc.

## Tests and Time-Dependent Code

**NEVER write tests with hardcoded future dates that will fail once that date passes.**

### Bad Examples (NEVER DO THIS)

```typescript
// Will break after 2025-12-31
expect(isExpired("2025-12-31")).toBe(false);

// Will break after January 2025
const futureDate = new Date("2025-01-15");
expect(isInFuture(futureDate)).toBe(true);
```

### Good Examples

```typescript
// Use relative dates
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
expect(isInFuture(tomorrow)).toBe(true);

// Use date arithmetic
const thirtyDaysFromNow = addDays(new Date(), 30);
expect(isExpired(thirtyDaysFromNow)).toBe(false);

// For fixed historical dates (safe - they never change)
expect(isExpired("2020-01-01")).toBe(true);
```

## Date Libraries and Utilities

- Prefer established libraries (date-fns, dayjs, luxon) over manual date manipulation
- Use timezone-aware functions when dealing with user-facing dates
- Be explicit about UTC vs local time

## Timestamps and Logging

- Use ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`) for machine-readable timestamps
- Store dates in UTC, convert to local time only for display
- Include timezone information in logs and exports

## Age and Duration Calculations

```typescript
// Good: Calculate age relative to now
const ageInDays = differenceInDays(new Date(), createdAt);

// Bad: Hardcode a reference date
const ageInDays = differenceInDays(new Date("2025-01-01"), createdAt);
```

## Fixtures and Test Data

- Use factory functions that generate dates relative to `new Date()`
- If you need deterministic dates in tests, mock `Date.now()` or use a test clock
- Document why specific dates were chosen if they must be hardcoded

```typescript
// Good: Factory with relative dates
function createTestUser(daysOld: number = 30) {
  return {
    createdAt: subDays(new Date(), daysOld),
  };
}

// Good: Mock the clock for deterministic tests
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2024-06-15"));
});
```

## Web Search and Research

- When searching for documentation or news, include the current year in queries
- Specify "latest" or the current year to avoid outdated results
- Be skeptical of dates in search results that predate the current date significantly

## Expiration and Validity Checks

- Use time windows (e.g., "within 30 days") rather than absolute dates
- Consider timezone implications for "end of day" calculations
- Account for clock skew in distributed systems

## Summary

| Scenario | Do | Don't |
|----------|-----|-------|
| Tests | Use relative dates, mock clocks | Hardcode future dates |
| Logs | ISO 8601 with timezone | Ambiguous formats |
| Storage | UTC timestamps | Local time without zone |
| Display | Convert to user's timezone | Assume everyone is UTC |
| Assertions | Reference injected current date | Guess based on context |
