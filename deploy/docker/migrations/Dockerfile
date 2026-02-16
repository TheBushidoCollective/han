# Han Team Platform - Database Migrations
# Migrations are now handled by han-server via SeaORM

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

# Build the han-server binary (includes migration runner)
RUN cd packages/han-rs && cargo build --release -p han-server

# Runtime
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/packages/han-rs/target/release/han-server ./han-server

# Create non-root user
RUN groupadd -r han && useradd -r -g han han
RUN chown -R han:han /app
USER han

# Default: run migrations
CMD ["./han-server", "migrate"]
