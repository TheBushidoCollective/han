# GreenFairy Filter Pattern (CRITICAL)

## Overview

Han uses a **GreenFairy-style** auto-generated filter system inspired by Hasura/Seaography. All GraphQL connections and list fields MUST use structured filter input types instead of ad-hoc arguments.

## Core Rules

### 1. NEVER Add Ad-Hoc Filter Arguments to Connection Fields

```graphql
# WRONG — ad-hoc arguments
sessions(projectId: String, repoId: String, status: String): SessionConnection!

# CORRECT — structured filter input
sessions(filter: SessionFilter, orderBy: SessionOrderBy): SessionConnection!
```

Ad-hoc arguments like `projectId`, `repoId`, `status`, `userId`, `worktreeName` on connection fields are **violations**. All filtering goes through the `filter` input type.

### 2. Underscore-Prefixed Operators

All filter operators MUST start with an underscore, following the Hasura/GreenFairy convention:

| Operator | GraphQL Name | Rust Field |
|----------|-------------|------------|
| Equal | `_eq` | `eq` |
| Not equal | `_ne` | `ne` |
| Greater than | `_gt` | `gt` |
| Greater than or equal | `_gte` | `gte` |
| Less than | `_lt` | `lt` |
| Less than or equal | `_lte` | `lte` |
| Contains | `_contains` | `contains` |
| Starts with | `_startsWith` | `starts_with` |
| Ends with | `_endsWith` | `ends_with` |
| In list | `_in` | `in_list` |
| Not in list | `_notIn` | `not_in` |
| Is null | `_isNull` | `is_null` |
| Logical AND | `_and` | `and` |
| Logical OR | `_or` | `or` |
| Logical NOT | `_not` | `not` |

### 3. Association Filtering

Filters MUST support filtering through relationships (associations). This enables queries like:

```graphql
# Filter sessions by their project's repo
sessions(filter: {
  project: {
    repo: {
      id: { _eq: "some-repo-id" }
    }
  }
}) {
  edges { node { id } }
}

# Filter messages by their session's project
messages(filter: {
  session: {
    projectId: { _eq: "some-project-id" }
  }
}) {
  edges { node { id } }
}
```

Association fields on filters are **nested filter types** for the related entity. They translate to `EXISTS (SELECT 1 FROM related_table WHERE ...)` subqueries in SQL.

### 4. Connection Field Signatures

Connection fields should only accept:
- `first` / `after` / `last` / `before` — Relay pagination
- `filter` — The auto-generated `{Entity}Filter` input type
- `orderBy` — The auto-generated `{Entity}OrderBy` input type

```graphql
type Query {
  sessions(
    first: Int
    after: String
    last: Int
    before: String
    filter: SessionFilter
    orderBy: SessionOrderBy
  ): SessionConnection!
}
```

No other arguments.

### 5. Non-Connection List Fields

Resolver fields that return computed data (not direct entity lists) like `metrics()`, `activity()`, `dashboardAnalytics()` may accept scope arguments — but prefer using a filter input when possible.

## Implementation

### EntityFilter Derive Macro

The `#[derive(EntityFilter)]` macro generates filter and order-by types from a source struct:

```rust
#[derive(han_graphql_derive::EntityFilter)]
#[entity_filter(
    entity = "han_db::entities::sessions::Entity",
    columns = "han_db::entities::sessions::Column",
)]
struct SessionFilterSource {
    id: String,
    project_id: Option<String>,
    status: Option<String>,
    slug: Option<String>,
}
```

This generates:
- `SessionFilter` — InputObject with field-level filters + `_and`/`_or`/`_not`
- `SessionOrderBy` — InputObject with `OrderDirection` per field

### Association Fields

Association fields are declared as `()` marker fields with `#[entity_filter(assoc(...))]` on the source struct. The macro generates the nested filter field and `IN (SELECT ...)` subquery condition automatically:

```rust
#[derive(han_graphql_derive::EntityFilter)]
#[entity_filter(
    entity = "han_db::entities::sessions::Entity",
    columns = "han_db::entities::sessions::Column",
)]
struct SessionFilterSource {
    id: String,
    project_id: Option<String>,
    status: Option<String>,

    /// Association: sessions.project_id IN (SELECT id FROM projects WHERE ...)
    #[entity_filter(assoc(
        filter = "crate::types::project::ProjectFilter",
        local_column = "ProjectId",
        foreign_entity = "han_db::entities::projects::Entity",
        foreign_column = "han_db::entities::projects::Column::Id",
    ))]
    project: (),
}
```

This generates a `SessionFilter` with a `project: Option<ProjectFilter>` field that enables queries like:
```graphql
sessions(filter: { project: { repoId: { _eq: "some-repo-id" } } })
```

**All filter types, including associations, MUST be macro-generated. Never hand-write filter structs.** See `graphql/macro-generated-filters.md`.

### Filter Application

Filters are applied via the `to_condition()` method which produces a SeaORM `Condition` tree:

```rust
if let Some(ref filter) = filter {
    let condition = filter.to_condition();
    query = query.filter(condition);
}
```

## Files

| File | Purpose |
|------|---------|
| `han-rs/crates/han-api/src/filters/types.rs` | Scalar filter types (StringFilter, IntFilter, etc.) |
| `han-rs/crates/han-api/src/filters/apply.rs` | ApplyFilter trait implementations |
| `han-rs/crates/han-api/src/filters/ordering.rs` | OrderDirection enum |
| `han-rs/crates/han-graphql-derive/src/entity_filter.rs` | EntityFilter derive macro |
| `han-rs/crates/han-api/src/types/sessions/mod.rs` | SessionFilter definition |
| `han-rs/crates/han-api/src/types/messages/mod.rs` | MessageFilter definition |

## Violations Checklist

When auditing the schema, check for:

1. Connection fields with ad-hoc filter arguments (anything besides `first`/`after`/`last`/`before`/`filter`/`orderBy`)
2. Filter operators without underscore prefix
3. Missing association filters on entity filters
4. `_filter` / `_order_by` prefixed parameters that are intentionally unused (dead code)
5. Scalar filter arguments on computed resolvers that should use entity filters instead
