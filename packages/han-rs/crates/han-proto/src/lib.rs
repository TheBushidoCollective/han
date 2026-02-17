//! Protobuf definitions for Han coordinator gRPC services.
//!
//! Generated from `proto/coordinator.proto` via tonic-build.
//! Provides 6 services: Coordinator, Session, Indexer, Hook, Slot, Memory.

pub mod coordinator {
    tonic::include_proto!("han.coordinator");
}

pub use coordinator::*;
