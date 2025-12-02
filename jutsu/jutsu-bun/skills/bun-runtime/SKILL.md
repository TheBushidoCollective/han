---
name: jutsu-bun:bun-runtime
description: Use when working with Bun's runtime APIs including file I/O, HTTP servers, and native APIs. Covers modern JavaScript/TypeScript execution in Bun's fast runtime environment.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Bun Runtime APIs

Use this skill when working with Bun's runtime environment, including file system operations, HTTP servers, environment variables, and Bun-specific APIs.

## Key Concepts

### Bun Globals

Bun provides several global APIs that are optimized for performance:

- `Bun.file()` - Fast file reading with automatic content-type detection
- `Bun.write()` - High-performance file writing
- `Bun.serve()` - Ultra-fast HTTP server
- `Bun.env` - Type-safe environment variables
- `Bun.$` - Shell command execution with template literals

### File I/O

Bun's file APIs are significantly faster than Node.js equivalents:

```typescript
// Reading files
const file = Bun.file("./data.json");
const text = await file.text();
const json = await file.json();
const arrayBuffer = await file.arrayBuffer();

// Writing files
await Bun.write("output.txt", "Hello, Bun!");
await Bun.write("data.json", { key: "value" });

// Streaming large files
const file = Bun.file("large-file.txt");
const stream = file.stream();
```

### HTTP Server

Bun.serve() provides exceptional performance:

```typescript
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response("Hello, Bun!");
    }

    if (url.pathname === "/api/data") {
      return Response.json({ message: "Fast API response" });
    }

    return new Response("Not Found", { status: 404 });
  },
});
```

### WebSocket Support

Built-in WebSocket support without external dependencies:

```typescript
Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // WebSocket upgrade successful
    }
    return new Response("Expected WebSocket connection", { status: 400 });
  },
  websocket: {
    message(ws, message) {
      console.log("Received:", message);
      ws.send(`Echo: ${message}`);
    },
    open(ws) {
      console.log("Client connected");
    },
    close(ws) {
      console.log("Client disconnected");
    },
  },
});
```

## Best Practices

### Use Native APIs

Prefer Bun's native APIs over Node.js equivalents for better performance:

```typescript
// Good - Use Bun.file()
const data = await Bun.file("./data.json").json();

// Avoid - Don't use fs from Node.js when Bun alternatives exist
import fs from "fs/promises";
const data = JSON.parse(await fs.readFile("./data.json", "utf-8"));
```

### Type Safety with Environment Variables

Use type-safe environment variable access:

```typescript
// Good - Type-safe access
const apiKey = Bun.env.API_KEY;

// Also valid - process.env works but Bun.env is preferred
const port = process.env.PORT ?? "3000";
```

### Efficient Shell Commands

Use `Bun.$` for shell command execution:

```typescript
// Execute shell commands safely
import { $ } from "bun";

const output = await $`ls -la`.text();
const gitBranch = await $`git branch --show-current`.text();

// With error handling
try {
  await $`npm run build`;
} catch (error) {
  console.error("Build failed:", error);
}
```

### Password Hashing

Use built-in password hashing:

```typescript
const password = "super-secret";

// Hash a password
const hash = await Bun.password.hash(password);

// Verify a password
const isMatch = await Bun.password.verify(password, hash);
```

## Common Patterns

### API Server with JSON

```typescript
interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/users") {
      return Response.json(users);
    }

    if (url.pathname.startsWith("/api/users/")) {
      const id = parseInt(url.pathname.split("/")[3]);
      const user = users.find((u) => u.id === id);

      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      return Response.json(user);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});
```

### File Upload Handler

```typescript
Bun.serve({
  port: 3000,
  async fetch(req) {
    if (req.method === "POST" && new URL(req.url).pathname === "/upload") {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return Response.json({ error: "No file provided" }, { status: 400 });
      }

      await Bun.write(`./uploads/${file.name}`, file);

      return Response.json({
        message: "File uploaded successfully",
        filename: file.name,
        size: file.size,
      });
    }

    return new Response("Method not allowed", { status: 405 });
  },
});
```

### Reading Configuration Files

```typescript
// Read and parse JSON config
const config = await Bun.file("./config.json").json();

// Read TOML (Bun has built-in TOML support)
const tomlConfig = await Bun.file("./config.toml").text();

// Read environment-specific config
const env = Bun.env.NODE_ENV ?? "development";
const envConfig = await Bun.file(`./config.${env}.json`).json();
```

## Anti-Patterns

### Don't Mix Node.js and Bun APIs Unnecessarily

```typescript
// Bad - Mixing APIs without reason
import fs from "fs/promises";
const data1 = await fs.readFile("file1.txt", "utf-8");
const data2 = await Bun.file("file2.txt").text();

// Good - Use consistent APIs
const data1 = await Bun.file("file1.txt").text();
const data2 = await Bun.file("file2.txt").text();
```

### Don't Ignore Error Handling

```typescript
// Bad - No error handling
const data = await Bun.file("./might-not-exist.json").json();

// Good - Proper error handling
try {
  const file = Bun.file("./might-not-exist.json");
  if (await file.exists()) {
    const data = await file.json();
  } else {
    console.error("File not found");
  }
} catch (error) {
  console.error("Failed to read file:", error);
}
```

### Don't Block the Event Loop

```typescript
// Bad - Synchronous file reading blocks
import fs from "fs";
const data = fs.readFileSync("large-file.txt", "utf-8");

// Good - Async operations
const data = await Bun.file("large-file.txt").text();
```

## Related Skills

- **bun-testing**: Testing Bun applications with built-in test runner
- **bun-bundler**: Building and bundling with Bun's fast bundler
- **bun-package-manager**: Managing dependencies with Bun's package manager
