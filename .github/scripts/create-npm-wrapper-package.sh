#!/bin/bash
# Create npm wrapper package that installs platform-specific binary
# Usage: ./create-npm-wrapper-package.sh v3.4.1

set -e

VERSION="${1#v}"

mkdir -p package

# Copy wrapper bin script from repo
cp .github/scripts/npm-wrapper-bin.js package/bin.js
chmod +x package/bin.js

# Create package.json
cat > package/package.json << EOF
{
  "name": "@thebushidocollective/han",
  "version": "${VERSION}",
  "description": "CLI for installing and managing curated Claude Code plugins from the Han marketplace",
  "homepage": "https://han.guru",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/TheBushidoCollective/han"
  },
  "bin": {
    "han": "bin.js"
  },
  "optionalDependencies": {
    "@thebushidocollective/han-darwin-arm64": "${VERSION}",
    "@thebushidocollective/han-darwin-x64": "${VERSION}",
    "@thebushidocollective/han-linux-arm64": "${VERSION}",
    "@thebushidocollective/han-linux-x64": "${VERSION}",
    "@thebushidocollective/han-win32-x64": "${VERSION}"
  },
  "keywords": [
    "claude",
    "claude-code",
    "plugins",
    "mcp",
    "han",
    "bushido"
  ]
}
EOF

# Create README
cat > package/README.md << 'EOF'
# Han CLI

CLI for installing and managing curated Claude Code plugins from the [Han marketplace](https://han.guru).

## Usage

```bash
# Run directly via npx
npx @thebushidocollective/han plugin install --auto

# Or install globally
npm install -g @thebushidocollective/han
han plugin list
```

## MCP Server Usage

Configure in your Claude Code plugin:

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
EOF

echo "Wrapper package contents:"
ls -la package/
cat package/package.json
