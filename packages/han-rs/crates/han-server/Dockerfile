# Multi-stage Dockerfile for han-server
# Stage 1: Build the Rust binary
# Stage 2: Minimal runtime image

FROM rust:1.86-bookworm AS builder

# Install protobuf compiler (required by han-proto's build.rs / tonic-build)
RUN apt-get update && \
    apt-get install -y --no-install-recommends protobuf-compiler && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy workspace Cargo files first for dependency caching
COPY Cargo.toml Cargo.lock ./
COPY crates/han-db/Cargo.toml crates/han-db/Cargo.toml
COPY crates/han-api/Cargo.toml crates/han-api/Cargo.toml
COPY crates/han-indexer/Cargo.toml crates/han-indexer/Cargo.toml
COPY crates/han-proto/Cargo.toml crates/han-proto/Cargo.toml
COPY crates/han-coordinator/Cargo.toml crates/han-coordinator/Cargo.toml
COPY crates/han-server/Cargo.toml crates/han-server/Cargo.toml

# Create stub source files so cargo can resolve dependencies
RUN mkdir -p crates/han-db/src && echo "pub fn stub() {}" > crates/han-db/src/lib.rs && \
    mkdir -p crates/han-api/src && echo "pub fn stub() {}" > crates/han-api/src/lib.rs && \
    mkdir -p crates/han-indexer/src && echo "fn main() {}" > crates/han-indexer/src/main.rs && \
    mkdir -p crates/han-proto/src && echo "pub fn stub() {}" > crates/han-proto/src/lib.rs && \
    mkdir -p crates/han-proto/proto && echo 'syntax = "proto3"; package coordinator;' > crates/han-proto/proto/coordinator.proto && \
    mkdir -p crates/han-coordinator/src && echo "fn main() {}" > crates/han-coordinator/src/main.rs && \
    mkdir -p crates/han-server/src && echo "fn main() {}" > crates/han-server/src/main.rs

# Build dependencies only (cached layer)
RUN cargo build --release --package han-server

# Copy actual source code
COPY crates/ crates/

# Touch source files to invalidate the build cache for actual code
RUN touch crates/han-db/src/lib.rs crates/han-api/src/lib.rs crates/han-server/src/main.rs

# Build the actual binary
RUN cargo build --release --package han-server

# Stage 2: Minimal runtime
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash han

COPY --from=builder /build/target/release/han-server /usr/local/bin/han-server

USER han

EXPOSE 8080

ENV PORT=8080
ENV RUST_LOG=info

CMD ["han-server"]
