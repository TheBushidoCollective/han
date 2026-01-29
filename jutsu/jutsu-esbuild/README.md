# jutsu-esbuild

esbuild build validation with automatic package manager detection.

## Overview

Provides Stop hooks that validate esbuild builds complete successfully before allowing Claude to finish working.

## Installation

```bash
han plugin install jutsu-esbuild
```

## Features

- Automatic package manager detection (npm, yarn, pnpm, bun)
- Build validation on Stop hook
- Caches successful builds to avoid redundant runs
