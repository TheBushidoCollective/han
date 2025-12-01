# Docker Compose Buki

Docker Compose configuration validation for container orchestration.

## Features

- Validates Docker Compose files with `docker compose config`
- Provides skills for working with Docker Compose

## Requirements

Install Docker with Compose plugin:

```bash
# macOS
brew install docker

# Linux
curl -fsSL https://get.docker.com | sh
```

## Skills Included

- **docker-compose-basics**: Docker Compose configuration and usage

## Hook Behavior

Validates Docker Compose files (docker-compose.*.yaml, compose.*.yaml) using `docker compose config`.

## Installation

Install with npx (no installation required):

```bash
npx @thebushidocollective/han plugin install buki-docker-compose
```
