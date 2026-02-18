//! GraphQL Mutation root.

use async_graphql::*;
use sea_orm::DatabaseConnection;

use crate::types::enums::PluginScope;

/// Result of a plugin mutation.
#[derive(Debug, Clone, SimpleObject)]
pub struct PluginMutationResult {
    /// Whether the operation succeeded.
    pub success: Option<bool>,
    /// Status message.
    pub message: Option<String>,
}

/// Result of starting a memory query with streaming.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryQueryStartResult {
    /// Session ID to use for subscribing to progress updates.
    pub session_id: Option<String>,
    /// Whether the operation succeeded.
    pub success: Option<bool>,
    /// Status message or error details.
    pub message: Option<String>,
}

/// Mutation root type.
pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Enable or disable a plugin.
    async fn toggle_plugin(
        &self,
        _ctx: &Context<'_>,
        _name: String,
        _marketplace: String,
        _scope: PluginScope,
        _enabled: bool,
    ) -> Result<Option<PluginMutationResult>> {
        Ok(Some(PluginMutationResult {
            success: Some(true),
            message: Some("Plugin toggled (stub)".into()),
        }))
    }

    /// Remove a plugin from settings.
    async fn remove_plugin(
        &self,
        _ctx: &Context<'_>,
        _name: String,
        _marketplace: String,
        _scope: PluginScope,
    ) -> Result<Option<PluginMutationResult>> {
        Ok(Some(PluginMutationResult {
            success: Some(true),
            message: Some("Plugin removed (stub)".into()),
        }))
    }

    /// Start a memory query with streaming results.
    async fn start_memory_query(
        &self,
        _ctx: &Context<'_>,
        _question: String,
        _project_path: String,
        _model: Option<String>,
    ) -> Result<Option<MemoryQueryStartResult>> {
        Ok(Some(MemoryQueryStartResult {
            session_id: None,
            success: Some(false),
            message: Some("Memory query not yet implemented in coordinator".into()),
        }))
    }

    /// Register a new config directory.
    async fn register_config_dir(
        &self,
        ctx: &Context<'_>,
        _path: String,
        _name: Option<String>,
    ) -> Result<bool> {
        let _db = ctx.data::<DatabaseConnection>()?;
        Ok(true)
    }

    /// Unregister a config directory.
    async fn unregister_config_dir(
        &self,
        ctx: &Context<'_>,
        _path: String,
    ) -> Result<bool> {
        let _db = ctx.data::<DatabaseConnection>()?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mutation_root_can_be_constructed() {
        let _m = MutationRoot;
    }

    #[test]
    fn plugin_mutation_result_fields() {
        let r = PluginMutationResult {
            success: Some(true),
            message: Some("ok".into()),
        };
        assert_eq!(r.success, Some(true));
        assert_eq!(r.message, Some("ok".into()));
    }

    #[test]
    fn memory_query_start_result_fields() {
        let r = MemoryQueryStartResult {
            session_id: Some("s1".into()),
            success: Some(true),
            message: None,
        };
        assert_eq!(r.session_id, Some("s1".into()));
        assert_eq!(r.success, Some(true));
        assert!(r.message.is_none());
    }
}
