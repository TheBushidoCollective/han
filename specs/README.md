# Technical Specifications

Implementation documentation for the Han Plugin Marketplace.

## Overview

Han is a curated marketplace of Claude Code plugins built on Bushido principles. This directory contains technical specifications for all major systems.

## Systems

### Core

- [CLI Architecture](./cli-architecture.md) - Entry point, command structure, and CLI framework
- [Settings Management](./settings-management.md) - Multi-scope settings with precedence rules
- [Hook System](./hook-system.md) - Complete hook lifecycle from definition to execution

### Features

- [MCP Server](./mcp-server.md) - Model Context Protocol server exposing plugin tools
- [Plugin Installation](./plugin-installation.md) - Installation flow and marketplace integration

### Reference

- [Plugin Types](./plugin-types.md) - Bushido, Jutsu, Do, and Hashi plugin categories

## Documentation Standards

See [jutsu-specs](../jutsu/jutsu-specs/) for documentation guidelines.
