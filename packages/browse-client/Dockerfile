# Dashboard Static File Server
# Builds the browse-client and serves it as a static site

FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files and lockfile
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source files (respects .dockerignore)
COPY . .

# Verify schema exists for relay-compiler
RUN test -f schema.graphql || (echo "ERROR: schema.graphql missing" && exit 1)

# Build-time GraphQL URL injection (for team mode deployment)
ARG GRAPHQL_URL
ENV GRAPHQL_URL=${GRAPHQL_URL}

# Build the application: team-app when GRAPHQL_URL is non-empty, otherwise local-dashboard
RUN if [ -n "$GRAPHQL_URL" ]; then \
      HAN_BUILD_TARGET=team-app bun run build; \
    else \
      HAN_BUILD_TARGET=local-dashboard bun run build; \
    fi

# Verify build output
RUN test -f out/index.html || (echo "ERROR: Build failed - no index.html" && exit 1)
RUN ls -la out/

# Production stage
FROM oven/bun:1

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/out ./out
COPY --from=builder /app/serve.ts ./

# Use PORT env var (Railway sets this)
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "serve.ts"]
