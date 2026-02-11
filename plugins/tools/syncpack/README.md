# Syncpack

Syncpack validation and auto-fix for consistent dependency versions in JavaScript monorepos.

## Features

- **Automatic version fixing**: Runs `syncpack fix` to resolve version mismatches when stopping Claude Code
- **Package.json formatting**: Ensures consistent package.json structure across workspaces
- **Smart caching**: Only runs when package.json files or syncpack config have changed
- **Multiple workspace support**: Works with npm, Yarn, and pnpm workspaces

## Installation

```bash
han plugin install syncpack
```

## Hooks

### fix (Stop hook)

Automatically runs when you stop Claude Code to ensure dependency versions are consistent:

- Detects directories containing syncpack configuration files
- Only runs if `package.json` files or config have changed since last successful run
- Runs `syncpack fix` to automatically resolve version mismatches

### format

Formats package.json files consistently across the monorepo:

- Sorts dependencies alphabetically
- Applies consistent key ordering
- Can be triggered manually via `han hook run syncpack format`

## Syncpack Configuration

Create a `syncpack.config.js` at your monorepo root:

```js
export default {
  // Define where to find package.json files
  source: [
    'package.json',
    'packages/*/package.json',
    'apps/*/package.json',
  ],

  // Define version policies
  versionGroups: [
    {
      label: 'Pin TypeScript version',
      dependencies: ['typescript'],
      pinVersion: '5.3.3',
    },
    {
      label: 'Use highest semver for everything else',
      preferVersion: 'highestSemver',
    },
  ],
};
```

## Skills

This plugin provides the following skills:

- **syncpack-configuration**: Setup and configure syncpack for monorepos
- **syncpack-version-groups**: Define advanced version policies and dependency rules

## Common Use Cases

### Single Version Policy

Ensure all packages use the same version of each dependency:

```js
export default {
  versionGroups: [
    {
      preferVersion: 'highestSemver',
    },
  ],
};
```

### Ban Deprecated Packages

Prevent usage of specific packages:

```js
export default {
  versionGroups: [
    {
      dependencies: ['moment', 'request'],
      isBanned: true,
    },
  ],
};
```

### Framework Pinning

Lock framework versions across all packages:

```js
export default {
  versionGroups: [
    {
      dependencies: ['react', 'react-dom'],
      pinVersion: '18.2.0',
    },
  ],
};
```

## CI Integration

Add to your CI pipeline:

```yaml
- name: Check dependency versions
  run: npx syncpack list-mismatches --fail-fast
```

## Related Plugins

- **lerna**: For Lerna-based monorepos
- **npm**: For npm workspace management
- **yarn**: For Yarn workspace management

## Note

Syncpack v13 is the current stable version. A Rust rewrite is available at `npm install syncpack@alpha`.
