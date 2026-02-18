//! Schema assembly and SDL export.

use async_graphql::*;
use sea_orm::DatabaseConnection;
use tokio::sync::broadcast;

use crate::context::DbChangeEvent;
use crate::mutation::MutationRoot;
use crate::query::QueryRoot;
use crate::subscription::SubscriptionRoot;

/// The complete Han GraphQL schema type.
pub type HanSchema = Schema<QueryRoot, MutationRoot, SubscriptionRoot>;

/// Build the GraphQL schema with the given database connection and event sender.
pub fn build_schema(
    db: DatabaseConnection,
    event_sender: broadcast::Sender<DbChangeEvent>,
) -> HanSchema {
    Schema::build(QueryRoot, MutationRoot, SubscriptionRoot)
        .data(db)
        .data(event_sender)
        // Manually register types not directly reachable from root queries
        // but needed for fragments in browse-client.
        .register_output_type::<crate::types::messages::UserMessage>()
        .register_output_type::<crate::types::node::Node>()
        // Register enums used in browse-client queries but not referenced by root args
        .register_output_type::<crate::types::enums::Granularity>()
        .finish()
}

/// Export the schema as SDL (Schema Definition Language).
pub fn export_sdl(schema: &HanSchema) -> String {
    schema.sdl()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a schema without DB connection for SDL testing only.
    /// No resolvers are called during SDL export - just type registration.
    fn build_test_schema() -> HanSchema {
        use crate::mutation::MutationRoot;
        use crate::query::QueryRoot;
        use crate::subscription::SubscriptionRoot;

        Schema::build(QueryRoot, MutationRoot, SubscriptionRoot)
            .register_output_type::<crate::types::messages::UserMessage>()
            .register_output_type::<crate::types::node::Node>()
            .register_output_type::<crate::types::enums::Granularity>()
            .finish()
    }

    #[test]
    fn test_schema_builds() {
        let _schema = build_test_schema();
    }

    #[test]
    fn test_schema_sdl_export() {
        let schema = build_test_schema();
        let sdl = export_sdl(&schema);

        // Verify core types exist in SDL
        assert!(sdl.contains("type Query"), "Missing Query");
        assert!(sdl.contains("type MutationRoot"), "Missing MutationRoot");
        assert!(sdl.contains("type SubscriptionRoot"), "Missing SubscriptionRoot");

        // Verify key query fields
        assert!(sdl.contains("node("), "Missing node query");
        assert!(sdl.contains("projects("), "Missing projects query");
        assert!(sdl.contains("sessions("), "Missing sessions query");
        assert!(sdl.contains("coordinatorStatus"), "Missing coordinatorStatus");

        // Verify Session type
        assert!(sdl.contains("type Session"), "Missing Session type");
        assert!(sdl.contains("sessionId"), "Missing sessionId field");
        assert!(sdl.contains("messages("), "Missing messages connection");

        // Verify Message and UserMessage interfaces
        assert!(sdl.contains("interface Message"), "Missing Message interface");
        assert!(sdl.contains("interface UserMessage"), "Missing UserMessage interface");
        assert!(sdl.contains("RegularUserMessage"), "Missing RegularUserMessage");
        assert!(sdl.contains("AssistantMessage"), "Missing AssistantMessage");
        assert!(sdl.contains("HookRunMessage"), "Missing HookRunMessage");
        assert!(sdl.contains("McpToolCallMessage"), "Missing McpToolCallMessage");

        // Verify Content Block types
        assert!(sdl.contains("interface ContentBlock"), "Missing ContentBlock interface");
        assert!(sdl.contains("TextBlock"), "Missing TextBlock");
        assert!(sdl.contains("ThinkingBlock"), "Missing ThinkingBlock");
        assert!(sdl.contains("ToolUseBlock"), "Missing ToolUseBlock");
        assert!(sdl.contains("ToolResultBlock"), "Missing ToolResultBlock");

        // Verify Connection types
        assert!(sdl.contains("type MessageConnection"), "Missing MessageConnection");
        assert!(sdl.contains("type SessionConnection"), "Missing SessionConnection");
        assert!(sdl.contains("type PageInfo"), "Missing PageInfo");

        // Verify Enums
        assert!(sdl.contains("enum ContentBlockType"), "Missing ContentBlockType enum");
        assert!(sdl.contains("enum ToolCategory"), "Missing ToolCategory enum");

        // Filter types are defined but will be wired into queries in integration
        // They'll appear in SDL once referenced as query arguments

        // Verify Subscription types
        assert!(sdl.contains("nodeUpdated("), "Missing nodeUpdated subscription");
        assert!(sdl.contains("sessionMessageAdded("), "Missing sessionMessageAdded subscription");
        assert!(sdl.contains("sessionAdded("), "Missing sessionAdded subscription");

        // Verify mutations
        assert!(sdl.contains("togglePlugin("), "Missing togglePlugin mutation");

        // Verify Relay-compatible fields
        assert!(sdl.contains("hasNextPage"), "Missing hasNextPage");
        assert!(sdl.contains("hasPreviousPage"), "Missing hasPreviousPage");
        assert!(sdl.contains("startCursor"), "Missing startCursor");
        assert!(sdl.contains("endCursor"), "Missing endCursor");
        assert!(sdl.contains("totalCount"), "Missing totalCount");
    }

    #[test]
    fn test_schema_sdl_no_empty() {
        let schema = build_test_schema();
        let sdl = export_sdl(&schema);
        assert!(!sdl.is_empty());
        // Should be substantial - at least 2KB for all these types
        assert!(sdl.len() > 2000, "SDL too short: {} bytes", sdl.len());
    }
}
