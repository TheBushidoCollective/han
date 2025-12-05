# Technical Blueprints

Implementation documentation for the Han Plugin Marketplace.

## Overview

Han is a curated marketplace of Claude Code plugins built on Bushido principles. This directory contains technical blueprints for all major systems in the codebase, from CLI architecture to deployment workflows.

## Systems

### Core Infrastructure

- [CLI Architecture](./cli-architecture.md) - Entry point, command structure, and CLI framework
- [Settings Management](./settings-management.md) - Multi-scope settings with precedence rules
- [Hook System](./hook-system.md) - Complete hook lifecycle from definition to execution
- [Metrics System](./metrics-system.md) - Self-reporting agent performance tracking with validation
- [Native Module](./native-module.md) - High-performance Rust bindings for hook operations
- [Validation](./validation.md) - Configuration validation and schema enforcement

### Plugin Ecosystem

- [Plugin Types](./plugin-types.md) - Bushido, Jutsu, Do, and Hashi plugin categories
- [SDLC Coverage](./sdlc-coverage.md) - AI-native engineering workflow alignment with OpenAI's framework
- [Plugin Directory](./plugin-directory.md) - Filesystem organization and naming conventions
- [Plugin Installation](./plugin-installation.md) - Installation flow and marketplace integration
- [Marketplace](./marketplace.md) - Central plugin registry and distribution

### Integration & Deployment

- [MCP Server](./mcp-server.md) - Model Context Protocol server exposing plugin tools
- [Website](./website.md) - Static marketplace site with search and documentation
- [Build & Deployment](./build-deployment.md) - CI/CD automation for releases and deployments

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Plugin Directory System                   │
│         (120+ plugins: Bushido, Jutsu, Do, Hashi)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                  ┌────┴────┐
                  ↓         ↓
            Marketplace   Website
            (Registry)    (Discovery)
                  │         │
                  └────┬────┘
                       ↓
         ┌─────────────────────────────┐
         │  Settings Management System │
         │  (Multi-scope configuration)│
         └─────────────┬────────────────┘
                       │
         ┌─────────────┴────────────────┐
         │                              │
         ↓                              ↓
  Plugin Installation           Hook System
  (Auto-detect, validate)      (Execute, cache, validate)
         │                              │
         │                        ┌─────┴─────┐
         │                        ↓           ↓
         │                   Validation   Native Module
         │                   (Config)     (Performance)
         │                        │
         └────────┬───────────────┘
                  ↓
           CLI Tool System
           (Commands, UI, MCP)
                  │
           ┌──────┴──────┐
           ↓             ↓
      MCP Server    Build & Deploy
      (Tools)       (CI/CD, Release)
```

## Documentation Standards

See [jutsu-blueprints](../jutsu/jutsu-blueprints/) for documentation guidelines and best practices for maintaining technical blueprints.
