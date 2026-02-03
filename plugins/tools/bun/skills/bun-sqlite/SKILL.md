---
name: jutsu-bun:bun-sqlite
description: Use when working with SQLite databases in Bun. Covers Bun's built-in SQLite driver, database operations, prepared statements, and transactions with high performance.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Bun SQLite

Use this skill when working with SQLite databases using Bun's built-in, high-performance SQLite driver.

## Key Concepts

### Opening a Database

Bun includes a native SQLite driver:

```typescript
import { Database } from "bun:sqlite";

// Open or create database
const db = new Database("mydb.sqlite");

// In-memory database
const memDb = new Database(":memory:");

// Read-only database
const readOnlyDb = new Database("mydb.sqlite", { readonly: true });
```

### Basic Queries

Execute SQL queries:

```typescript
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert data
db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["Alice", "alice@example.com"]);

// Query data
const users = db.query("SELECT * FROM users").all();
console.log(users);

// Close database
db.close();
```

### Prepared Statements

Use prepared statements for better performance:

```typescript
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");

// Prepare statement
const insertUser = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");

// Execute multiple times
insertUser.run("Alice", "alice@example.com");
insertUser.run("Bob", "bob@example.com");

// Prepared query
const findUser = db.prepare("SELECT * FROM users WHERE email = ?");
const user = findUser.get("alice@example.com");

console.log(user);
```

## Best Practices

### Use Prepared Statements

Prepared statements are faster and prevent SQL injection:

```typescript
// Good - Prepared statement
const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
const user = stmt.get(userId);

// Bad - String interpolation (SQL injection risk)
const user = db.query(`SELECT * FROM users WHERE id = ${userId}`).get();
```

### Transactions

Use transactions for atomic operations:

```typescript
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");

// Transaction with automatic rollback on error
const insertUsers = db.transaction((users: Array<{ name: string; email: string }>) => {
  const insert = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");

  for (const user of users) {
    insert.run(user.name, user.email);
  }
});

try {
  insertUsers([
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob", email: "bob@example.com" },
  ]);
  console.log("All users inserted");
} catch (error) {
  console.error("Transaction failed:", error);
}
```

### Query Methods

Different methods for different use cases:

```typescript
const db = new Database("mydb.sqlite");

// .all() - Get all rows
const allUsers = db.query("SELECT * FROM users").all();

// .get() - Get first row
const firstUser = db.query("SELECT * FROM users").get();

// .values() - Get array of arrays
const userValues = db.query("SELECT name, email FROM users").values();

// .run() - Execute without returning rows
db.run("DELETE FROM users WHERE id = ?", [userId]);
```

### Error Handling

Properly handle database errors:

```typescript
import { Database } from "bun:sqlite";

try {
  const db = new Database("mydb.sqlite");

  const stmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
  stmt.run("Alice", "alice@example.com");

  db.close();
} catch (error) {
  if (error instanceof Error) {
    console.error("Database error:", error.message);
  }
}
```

## Common Patterns

### CRUD Operations

```typescript
import { Database } from "bun:sqlite";

interface User {
  id?: number;
  name: string;
  email: string;
  created_at?: string;
}

class UserRepository {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.createTable();
  }

  private createTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  create(user: User): User {
    const stmt = this.db.prepare("INSERT INTO users (name, email) VALUES (?, ?) RETURNING *");
    return stmt.get(user.name, user.email) as User;
  }

  findById(id: number): User | null {
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
    return (stmt.get(id) as User) || null;
  }

  findAll(): User[] {
    return this.db.query("SELECT * FROM users").all() as User[];
  }

  update(id: number, user: Partial<User>): User | null {
    const stmt = this.db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name), email = COALESCE(?, email)
      WHERE id = ?
      RETURNING *
    `);
    return (stmt.get(user.name, user.email, id) as User) || null;
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare("DELETE FROM users WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  close() {
    this.db.close();
  }
}

// Usage
const users = new UserRepository("mydb.sqlite");
const newUser = users.create({ name: "Alice", email: "alice@example.com" });
console.log(newUser);
```

### Bulk Inserts with Transaction

```typescript
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");

const bulkInsert = db.transaction((items: Array<{ name: string; email: string }>) => {
  const stmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");

  for (const item of items) {
    stmt.run(item.name, item.email);
  }
});

// Insert 1000 users atomically
const users = Array.from({ length: 1000 }, (_, i) => ({
  name: `User ${i}`,
  email: `user${i}@example.com`,
}));

bulkInsert(users);
```

### Migrations

```typescript
import { Database } from "bun:sqlite";

class DatabaseMigration {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initMigrationTable();
  }

  private initMigrationTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private hasRun(name: string): boolean {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM migrations WHERE name = ?");
    const result = stmt.get(name) as { count: number };
    return result.count > 0;
  }

  private recordMigration(name: string) {
    this.db.run("INSERT INTO migrations (name) VALUES (?)", [name]);
  }

  migrate(name: string, sql: string) {
    if (this.hasRun(name)) {
      console.log(`Migration ${name} already applied`);
      return;
    }

    const migration = this.db.transaction(() => {
      this.db.run(sql);
      this.recordMigration(name);
    });

    migration();
    console.log(`Migration ${name} applied successfully`);
  }

  close() {
    this.db.close();
  }
}

// Usage
const migration = new DatabaseMigration("mydb.sqlite");

migration.migrate(
  "001_create_users",
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )
`
);

migration.migrate(
  "002_add_timestamps",
  `
  ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP
`
);

migration.close();
```

### Query Builder Pattern

```typescript
import { Database } from "bun:sqlite";

class QueryBuilder<T> {
  private db: Database;
  private tableName: string;
  private whereClause: string[] = [];
  private whereValues: any[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(db: Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  where(column: string, value: any): this {
    this.whereClause.push(`${column} = ?`);
    this.whereValues.push(value);
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  offset(n: number): this {
    this.offsetValue = n;
    return this;
  }

  getAll(): T[] {
    let sql = `SELECT * FROM ${this.tableName}`;

    if (this.whereClause.length > 0) {
      sql += ` WHERE ${this.whereClause.join(" AND ")}`;
    }

    if (this.limitValue) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...this.whereValues) as T[];
  }

  getOne(): T | null {
    let sql = `SELECT * FROM ${this.tableName}`;

    if (this.whereClause.length > 0) {
      sql += ` WHERE ${this.whereClause.join(" AND ")}`;
    }

    sql += " LIMIT 1";

    const stmt = this.db.prepare(sql);
    return (stmt.get(...this.whereValues) as T) || null;
  }
}

// Usage
interface User {
  id: number;
  name: string;
  email: string;
}

const db = new Database("mydb.sqlite");

const query = new QueryBuilder<User>(db, "users");
const users = query.where("name", "Alice").limit(10).getAll();
console.log(users);
```

## Anti-Patterns

### Don't Use String Interpolation

```typescript
// Bad - SQL injection vulnerability
const userId = "1 OR 1=1";
const user = db.query(`SELECT * FROM users WHERE id = ${userId}`).get();

// Good - Use prepared statements
const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
const user = stmt.get(userId);
```

### Don't Forget to Close Database

```typescript
// Bad - Database remains open
const db = new Database("mydb.sqlite");
db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["Alice", "alice@example.com"]);

// Good - Close when done
const db = new Database("mydb.sqlite");
try {
  db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["Alice", "alice@example.com"]);
} finally {
  db.close();
}
```

### Don't Use Transactions for Single Operations

```typescript
// Bad - Unnecessary transaction
const insert = db.transaction(() => {
  db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["Alice", "alice@example.com"]);
});
insert();

// Good - Direct execution
db.run("INSERT INTO users (name, email) VALUES (?, ?)", ["Alice", "alice@example.com"]);
```

### Don't Reparse Queries

```typescript
// Bad - Reparsing query each iteration
for (let i = 0; i < 1000; i++) {
  db.run("INSERT INTO users (name, email) VALUES (?, ?)", [`User ${i}`, `user${i}@example.com`]);
}

// Good - Prepare once, execute many times
const stmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
for (let i = 0; i < 1000; i++) {
  stmt.run(`User ${i}`, `user${i}@example.com`);
}
```

## Related Skills

- **bun-runtime**: Core Bun runtime features and file I/O
- **bun-testing**: Testing database operations
- **bun-bundler**: Bundling applications with SQLite
