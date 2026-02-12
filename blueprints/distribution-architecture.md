---
name: distribution-architecture
summary: NPM wrapper with platform-specific Bun binaries, curl installer, and Homebrew distribution
---

# Distribution Architecture

Complete distribution model for delivering han via npm, curl installer, and Homebrew.

## Overview

Han uses a **multi-channel distribution model** to support different installation environments:

1. **npm wrapper + platform binaries** - Works everywhere with Node.js (primary)
2. **Homebrew tap** - macOS/Linux package manager (convenience)
3. **curl installer** - Direct binary installation (fast, minimal deps)

The npm distribution model ensures Han works in **ephemeral environments** (Claude Code Web, GitHub Codespaces) where binaries don't persist between sessions.

## npm Distribution Model

### Problem Solved

In ephemeral environments:

- Binary installations don't persist between sessions
- Users need `han` command available immediately
- MCP servers need to auto-install on demand
- Hooks need to execute without manual setup

### Solution: Wrapper + Platform Binaries

Han is distributed via npm with:

1. **Main wrapper package** - `@thebushidocollective/han`
2. **Platform-specific packages** - `@thebushidocollective/han-{platform}`

### Architecture

```
@thebushidocollective/han (wrapper)
├── bin/han.js                 # Entry point with platform detection
├── schemas/                   # JSON schemas
└── package.json
    └── optionalDependencies:
        ├── @thebushidocollective/han-darwin-arm64
        ├── @thebushidocollective/han-darwin-x64
        ├── @thebushidocollective/han-linux-arm64
        ├── @thebushidocollective/han-linux-x64
        └── @thebushidocollective/han-win32-x64

@thebushidocollective/han-{platform}
└── bin/
    └── han                    # Compiled Bun binary for platform
```

### Platform Packages

Five platform-specific packages published separately:

| Package | Platform | Contents |
|---------|----------|----------|
| `@thebushidocollective/han-linux-x64` | Linux x64 | Bun binary (compiled from TypeScript + Rust) |
| `@thebushidocollective/han-linux-arm64` | Linux ARM64 | Bun binary (compiled from TypeScript + Rust) |
| `@thebushidocollective/han-darwin-x64` | macOS Intel | Bun binary (compiled from TypeScript + Rust) |
| `@thebushidocollective/han-darwin-arm64` | macOS Apple Silicon | Bun binary (compiled from TypeScript + Rust) |
| `@thebushidocollective/han-win32-x64` | Windows x64 | Bun binary (compiled from TypeScript + Rust) |

Each package contains a **single compiled Bun binary** that embeds:

- TypeScript code (compiled to JS)
- Rust native module (han-native)
- All dependencies

### Installation Flow

When a user runs:

```bash
npx -y @thebushidocollective/han plugin install
```

npm/npx:

1. **Downloads main package** - `@thebushidocollective/han`
2. **Detects platform** - OS + architecture from Node.js
3. **Downloads matching platform package** - Only the one needed
4. **Executes wrapper** - `bin/han.js`

### Execution Flow

`bin/han.js` (the wrapper):

```javascript
#!/usr/bin/env node

// Detect platform
const platform = process.platform;  // darwin, linux, win32
const arch = process.arch;          // x64, arm64

// Map to package name
const pkgName = `@thebushidocollective/han-${platform}-${arch}`;

// Find binary in node_modules
const binaryPath = require.resolve(`${pkgName}/bin/han`);

// Execute the Bun binary (NOT Node.js!)
const { execFileSync } = require('child_process');
execFileSync(binaryPath, process.argv.slice(2), { stdio: 'inherit' });
```

**Key point**: The wrapper **executes the Bun binary**, not Node.js. This means:

- All Bun built-ins work (`bun:sqlite`, `bun:ffi`, etc.)
- Full Bun performance
- No Node.js compatibility layer needed

### optionalDependencies Strategy

The wrapper package declares platform binaries as `optionalDependencies`:

```json
{
  "name": "@thebushidocollective/han",
  "optionalDependencies": {
    "@thebushidocollective/han-darwin-arm64": "3.12.6",
    "@thebushidocollective/han-darwin-x64": "3.12.6",
    "@thebushidocollective/han-linux-arm64": "3.12.6",
    "@thebushidocollective/han-linux-x64": "3.12.6",
    "@thebushidocollective/han-win32-x64": "3.12.6"
  }
}
```

**Why optionalDependencies?**

- npm installs **only the matching platform** automatically
- Other platforms are silently skipped (no error)
- Smaller install size (no multi-platform bloat)

### MCP Server Usage

MCP servers use npx to run han:

```json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp"]
    }
  }
}
```

**Behavior**:

1. Claude Code spawns npx process
2. npx downloads han (if not cached)
3. npm installs wrapper + platform binary
4. Wrapper executes Bun binary
5. MCP server starts

**Benefits**:

- No manual installation required
- Works in ephemeral environments
- Auto-updates with `-y` flag
- Cached across sessions (npx cache)

### Hooks Usage

Hooks reference `han` directly in plugin configs:

```yaml
# core/hooks/hooks.json
hooks:
  SessionStart:
    - hooks:
      - type: command
        command: han hook context
```

**How it works**:

1. Claude Code looks for `han` in PATH
2. If not found, falls back to `npx @thebushidocollective/han`
3. Wrapper downloads + executes Bun binary
4. Hook runs

**Setup hook** (core plugin) auto-installs han to `~/.claude/bin/han` for faster execution.

## Bun Binary Compilation

### Build Process

See `packages/han/scripts/build-bundle.js`:

```bash
bun build lib/main.ts \
  --compile \
  --outfile dist/binaries/han-{platform} \
  --target {bun_target} \
  --sourcemap
```

**What gets bundled**:

- All TypeScript code (compiled to JS)
- Rust native module (`packages/han-native/*.node`)
- Dependencies (except Bun built-ins)

**Target platforms**:

- `bun-linux-x64`
- `bun-linux-arm64`
- `bun-darwin-x64`
- `bun-darwin-arm64`
- `bun-windows-x64`

### Binary Structure

```
han-darwin-arm64 (Bun binary)
├── Bun runtime
├── TypeScript code (JS)
├── han-native.node (Rust)
└── Dependencies
```

**Embedded native module**:

The Rust native module is copied into `packages/han/native/han-native.node` before compilation:

```bash
# In release-binaries.yml
mkdir -p native
cp ../han-native/${{ matrix.native_file }} native/han-native.node
bun scripts/build-bundle.js ${{ matrix.bun_target }}
```

Bun's `--compile` flag embeds this file into the binary.

### Runtime Loading

At runtime, the binary loads the native module:

```typescript
// packages/han/native/loader.ts
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const native = require("./han-native.node");

export const {
  orchestrateHooks,
  registerCheckpoint,
  // ... other exports
} = native;
```

**Key point**: This works because:

1. Native module is embedded in the binary
2. Bun's require() can load embedded `.node` files
3. No external native module needed

## Bun-Specific Features

### Why Bun Matters

Since the binary is compiled with Bun, **all Bun built-ins work**:

```typescript
import { Database } from "bun:sqlite";  // ✅ Works
import { serve } from "bun";            // ✅ Works
import { dlopen } from "bun:ffi";       // ✅ Works
```

**No Node.js compatibility needed**:

- Don't check `typeof Bun !== "undefined"`
- Don't provide Node.js fallbacks
- Use Bun APIs unconditionally

### Performance Benefits

Bun runtime is **faster than Node.js**:

- Faster startup time
- Faster SQLite operations (`bun:sqlite`)
- Faster HTTP server (`Bun.serve`)
- Native FFI (`bun:ffi`)

### Database Access

Han uses `bun:sqlite` for all database operations:

```typescript
import { Database } from "bun:sqlite";

const db = new Database("~/.han/han.db");
db.query("SELECT * FROM sessions").all();
```

**This works everywhere** because the binary includes Bun runtime.

## Curl Installer

**URL**: https://han.guru/install.sh

**Purpose**: Direct binary installation for faster CLI execution

### Installation Script

```bash
curl -fsSL https://han.guru/install.sh | bash
```

**Behavior**:

1. Detects platform (OS + architecture)
2. Downloads latest release binary from GitHub
3. Installs to `~/.claude/bin/han`
4. Adds `~/.claude/bin` to PATH (if needed)

**Benefits**:

- **Faster execution** - No npx overhead
- **Minimal dependencies** - Just bash + curl
- **Works offline** - Once installed, no network calls

### Install Location

**Default**: `~/.claude/bin/han`

**Why this location?**

- Consistent with Claude Code conventions
- User-writable (no sudo needed)
- Easy to add to PATH
- Shared across Claude Code sessions

### PATH Setup

The installer prompts to add to shell profile:

```bash
export PATH="$HOME/.claude/bin:$PATH"
```

**Shells supported**:

- bash (`~/.bashrc`, `~/.bash_profile`)
- zsh (`~/.zshrc`)
- fish (`~/.config/fish/config.fish`)

## Homebrew Tap

**Repository**: https://github.com/TheBushidoCollective/homebrew-tap

**Formula**: `Formula/han.rb`

### Installation

```bash
brew install thebushidocollective/tap/han
```

### Auto-Update Flow

When `release-binaries.yml` creates a release:

1. **update-homebrew job** triggers
2. Generates formula with version and checksums
3. Commits to homebrew-tap repo
4. Homebrew auto-updates on next `brew update`

### Formula Generation

See `.github/scripts/generate-homebrew-formula.sh`:

```ruby
class Han < Formula
  desc "CLI for managing Claude Code plugins from Han marketplace"
  homepage "https://han.guru"
  version "3.12.6"
  
  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/TheBushidoCollective/han/releases/download/v3.12.6/han-darwin-arm64"
      sha256 "..."
    else
      url "https://github.com/TheBushidoCollective/han/releases/download/v3.12.6/han-darwin-x64"
      sha256 "..."
    end
  end
  
  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/TheBushidoCollective/han/releases/download/v3.12.6/han-linux-arm64"
      sha256 "..."
    else
      url "https://github.com/TheBushidocollective/han/releases/download/v3.12.6/han-linux-x64"
      sha256 "..."
    end
  end
  
  def install
    bin.install "han-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch}" => "han"
  end
end
```

**Key details**:

- Platform-specific URLs and checksums
- Single binary installation (no dependencies)
- Auto-updates via Homebrew

## Distribution Comparison

| Method | Use Case | Benefits | Drawbacks |
|--------|----------|----------|-----------|
| **npm/npx** | Ephemeral environments, MCP servers, hooks | Auto-install, works everywhere with Node.js | Slower execution (npx overhead) |
| **curl installer** | Developer machines, CI/CD | Fast execution, minimal deps | Manual PATH setup |
| **Homebrew** | macOS/Linux users who prefer package managers | Auto-updates, familiar workflow | macOS/Linux only |

## Version Synchronization

All distribution channels use the **same version**:

- npm wrapper: `@thebushidocollective/han@3.12.6`
- Platform packages: `@thebushidocollective/han-{platform}@3.12.6`
- GitHub release: `v3.12.6`
- Homebrew formula: `version "3.12.6"`
- Curl installer: Downloads `v3.12.6` binary

**Version bumping**: See [Build & Deployment](./build-deployment.md)

## Developer Workflows

### Installing for Development

**Option 1: npm (global)**

```bash
npm install -g @thebushidocollective/han
```

**Option 2: Homebrew**

```bash
brew install thebushidocollective/tap/han
```

**Option 3: curl**

```bash
curl -fsSL https://han.guru/install.sh | bash
```

**Option 4: Build from source**

```bash
git clone https://github.com/TheBushidoCollective/han.git
cd han/packages/han-native && npm run build
cd ../han && bun install && bun run build:binary
```

### Using in Claude Code

**MCP servers** (automatically use npx):

```json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp"]
    }
  }
}
```

**Hooks** (use han in PATH or npx fallback):

```yaml
hooks:
  SessionStart:
    - hooks:
      - type: command
        command: han hook context
```

**Local development override**:

Create `.claude/han.yml`:

```yaml
hanBinary: bun "$(git rev-parse --show-toplevel)/packages/han/lib/main.ts"
```

This causes all `han` calls to use local TypeScript source instead of the installed binary.

## Troubleshooting

### "Cannot find module 'bun:sqlite'"

**Cause**: Running built JavaScript with Node.js instead of Bun binary

**Fix**: Use the wrapper or binary:

```bash
# Wrong (runs with Node.js)
node dist/lib/main.js

# Right (runs with Bun binary)
npx @thebushidocollective/han

# Or use installed binary
han
```

### Platform binary not found

**Cause**: npm didn't install the platform package

**Check**:

```bash
ls node_modules/@thebushidocollective/han-*/
```

**Fix**:

```bash
npm install @thebushidocollective/han-{platform}
```

### Wrong platform installed

**Cause**: Installing on different platform than expected

**Check platform**:

```bash
node -p "process.platform + '-' + process.arch"
# darwin-arm64
```

**Verify package**:

```bash
npm list @thebushidocollective/han-darwin-arm64
```

## Related Systems

- [Build & Deployment](./build-deployment.md) - Builds binaries and publishes packages
- [CLI Architecture](./cli-architecture.md) - CLI structure and commands
- [Native Module](./native-module.md) - Rust bindings embedded in binary