# Han Team Platform - API Server
# Multi-stage build for the han-server Rust binary

# Stage 1: Builder
FROM rust:1-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Rust workspace
COPY packages/han-rs ./packages/han-rs

# Build the han-server binary
RUN cd packages/han-rs && cargo build --release -p han-server

# Stage 2: Production
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y ca-certificates curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy built binary from builder
COPY --from=builder /app/packages/han-rs/target/release/han-server ./han-server

# Create non-root user
RUN groupadd -r han && useradd -r -g han han
RUN chown -R han:han /app
USER han

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["./han-server"]
