# Han Team Platform - API Server
# Multi-stage build for the han-team API server

# Stage 1: Builder
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY packages/han-team-server/package.json ./packages/han-team-server/
COPY package.json bun.lockb* ./

# Install dependencies
RUN cd packages/han-team-server && bun install

# Copy source files
COPY packages/han-team-server ./packages/han-team-server

# Build the application
RUN cd packages/han-team-server && bun run build

# Stage 2: Production
FROM oven/bun:1-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy built artifacts from builder
COPY --from=builder /app/packages/han-team-server/dist ./dist
COPY --from=builder /app/packages/han-team-server/package.json ./
COPY --from=builder /app/packages/han-team-server/node_modules ./node_modules

# Copy migration files
COPY packages/han-team-server/migrations ./migrations

# Inline entrypoint script (avoids Docker context path issues)
RUN printf '#!/bin/bash\nset -e\nif [ "${AUTO_MIGRATE:-false}" = "true" ]; then\n  echo "Running database migrations..."\n  bun run migrate\n  echo "Migrations complete."\nfi\nexec "$@"\n' > ./entrypoint.sh && chmod +x ./entrypoint.sh

# Create non-root user
RUN groupadd -r han && useradd -r -g han han
RUN chown -R han:han /app
USER han

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["bun", "dist/server.js"]
