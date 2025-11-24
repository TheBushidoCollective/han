# Buki: Bun

Validation and quality enforcement for Bun.js projects.

## What This Buki Provides

### Validation Hooks

- **Bun Type Check**: Runs Bun's build type checker to ensure TypeScript code is valid
- **Fast Validation**: Leverages Bun's exceptional performance for rapid feedback

### Skills

This buki provides the following skills:

- **bun-runtime**: Working with Bun's runtime APIs including file I/O, HTTP servers, WebSockets, and native APIs
- **bun-testing**: Writing tests with Bun's built-in test runner, assertions, mocking, and snapshot testing
- **bun-bundler**: Bundling JavaScript/TypeScript code with Bun's fast bundler for different targets
- **bun-package-manager**: Managing dependencies with Bun's package manager, workspaces, and lockfiles
- **bun-sqlite**: Working with SQLite databases using Bun's built-in high-performance SQLite driver

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install buki-bun@han
```

## Usage

Once installed, this buki automatically validates your Bun code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

The validation runs `bun build --target=bun --no-bundle` to check for type errors without actually bundling your code.

## Requirements

- Bun 1.0.0 or higher
- TypeScript (for type checking)

## Why Bun?

Bun is an all-in-one JavaScript runtime and toolkit designed for speed:

- **Fast Runtime**: 3x faster than Node.js for many operations
- **Built-in Tools**: Bundler, test runner, package manager all included
- **Web Standard APIs**: First-class support for Web APIs like fetch, WebSocket
- **TypeScript Native**: Run TypeScript and JSX directly without transpilation
- **npm Compatible**: Works with existing npm packages
- **SQLite Built-in**: High-performance SQLite driver included

## Features Covered by Skills

### Runtime APIs
- File I/O with `Bun.file()` and `Bun.write()`
- HTTP servers with `Bun.serve()`
- WebSocket support
- Password hashing
- Environment variables
- Shell command execution with `Bun.$`

### Testing
- Built-in test runner
- Jest-compatible API
- Mocking and spies
- Snapshot testing
- Coverage reporting
- Watch mode

### Bundler
- Fast bundling for multiple targets (bun, browser, node)
- Tree shaking
- Code splitting
- Minification
- Source maps
- Plugin system

### Package Manager
- Fast dependency installation
- Binary lockfile (bun.lockb)
- Workspace support for monorepos
- npm/yarn/pnpm compatibility
- Global packages
- Link local packages

### SQLite
- Native SQLite driver
- Prepared statements
- Transactions
- Migration support
- High performance

## Examples

### Create a Simple HTTP Server

```typescript
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response("Hello from Bun!");
  },
});
```

### Run Tests

```typescript
import { test, expect } from "bun:test";

test("addition", () => {
  expect(1 + 1).toBe(2);
});
```

### Bundle Your Code

```bash
bun build src/index.ts --outdir dist --target browser --minify
```

### Install Dependencies

```bash
bun add express
bun add -d @types/express
```

### Use SQLite

```typescript
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");
db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
db.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
