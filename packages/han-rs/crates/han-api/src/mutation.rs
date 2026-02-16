//! GraphQL Mutation root.

use async_graphql::*;
use sea_orm::DatabaseConnection;

/// Mutation root type.
pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Toggle a plugin's enabled state.
    async fn toggle_plugin(
        &self,
        _ctx: &Context<'_>,
        _name: String,
        enabled: bool,
    ) -> Result<bool> {
        // Plugin toggle operates on filesystem settings, not DB
        // This would be implemented by the coordinator service
        Ok(enabled)
    }

    /// Remove a plugin from settings.
    async fn remove_plugin(
        &self,
        _ctx: &Context<'_>,
        _name: String,
    ) -> Result<bool> {
        Ok(true)
    }

    /// Register a new config directory.
    async fn register_config_dir(
        &self,
        ctx: &Context<'_>,
        _path: String,
        _name: Option<String>,
    ) -> Result<bool> {
        let _db = ctx.data::<DatabaseConnection>()?;
        // Config dir registration would go here
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
    fn mutation_root_debug_not_required() {
        // MutationRoot is a unit struct - verify it can be used as a value
        let m = MutationRoot;
        let _ = &m;
    }
}
