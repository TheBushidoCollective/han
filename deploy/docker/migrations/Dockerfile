# Han Team Platform - Database Migrations
# Standalone migration runner for init containers and CLI

FROM oven/bun:1-slim

WORKDIR /app

# Copy package files
COPY packages/han-team-server/package.json ./
RUN bun install --production

# Copy migration files and runner
COPY packages/han-team-server/migrations ./migrations
COPY packages/han-team-server/lib/migrations ./lib/migrations

# Create non-root user
RUN groupadd -r han && useradd -r -g han han
RUN chown -R han:han /app
USER han

# Default: run migrations
CMD ["bun", "run", "lib/migrations/run.ts"]
