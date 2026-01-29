# Rust Mutex Re-entrancy Deadlock

## Problem
Rust's `std::sync::Mutex` is NOT reentrant. If a function acquires a mutex lock and then calls another function that tries to acquire the same lock, it will deadlock.

## Example Pattern (DEADLOCK)
```rust
fn create_item() {
    let db = get_db()?;
    let conn = db.lock()?;  // Acquires lock
    conn.execute("INSERT...")?;
    get_item(&id)?  // DEADLOCK: calls lock() again
}

fn get_item(id: &str) {
    let db = get_db()?;
    let conn = db.lock()?;  // Blocks forever waiting for lock
    ...
}
```

## Solution: Use RETURNING Clause
Instead of calling a getter after insert/update, use SQL `RETURNING` to get the data in one query:

```rust
fn create_item() {
    let db = get_db()?;
    let conn = db.lock()?;
    conn.prepare("INSERT... RETURNING id, name, ...")?
        .query_row(params, |row| Ok(Item { ... }))
}
```

## Detection
- Tests hang indefinitely (not fail, just hang)
- Process shows minimal CPU time despite long wall clock time
- `sample <pid>` shows thread parked on semaphore_wait_trap

## Fixed in han-native
- `create_native_task()` in crud.rs
- `update_native_task()` in crud.rs
