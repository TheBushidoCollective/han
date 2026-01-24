# Dashboard Static File Server
# Builds the browse-client and serves it as a static site

FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
RUN bun install

# Copy source files
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/out ./out
COPY serve.ts ./

EXPOSE 3000

CMD ["bun", "serve.ts"]
