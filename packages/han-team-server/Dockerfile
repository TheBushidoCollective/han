# Han Team Platform - API Server
# Build context: packages/han-team-server

# Stage 1: Builder
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy source files
COPY . .

# Build the application
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy migration files
COPY migrations ./migrations

# Inline entrypoint script
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
