//! Migration: Add team-specific entities for hosted mode.
//!
//! Tables: users, teams, team_members, api_keys, synced_sessions,
//!         team_invites, encryption_keys

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Users table
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Users::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(Users::GithubId).string())
                    .col(ColumnDef::new(Users::GithubUsername).string())
                    .col(ColumnDef::new(Users::Email).string())
                    .col(ColumnDef::new(Users::DisplayName).string())
                    .col(ColumnDef::new(Users::AvatarUrl).string())
                    .col(ColumnDef::new(Users::Role).string().not_null().default("ic"))
                    .col(ColumnDef::new(Users::StripeCustomerId).string())
                    .col(ColumnDef::new(Users::SubscriptionId).string())
                    .col(ColumnDef::new(Users::SubscriptionStatus).string())
                    .col(ColumnDef::new(Users::CreatedAt).string().not_null())
                    .col(ColumnDef::new(Users::UpdatedAt).string().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_users_github_id")
                    .table(Users::Table)
                    .col(Users::GithubId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_users_email")
                    .table(Users::Table)
                    .col(Users::Email)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_users_stripe_customer_id")
                    .table(Users::Table)
                    .col(Users::StripeCustomerId)
                    .to_owned(),
            )
            .await?;

        // Teams table
        manager
            .create_table(
                Table::create()
                    .table(Teams::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Teams::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(Teams::Name).string().not_null())
                    .col(ColumnDef::new(Teams::Slug).string().not_null())
                    .col(ColumnDef::new(Teams::OwnerId).string().not_null())
                    .col(ColumnDef::new(Teams::CreatedAt).string().not_null())
                    .col(ColumnDef::new(Teams::UpdatedAt).string().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(Teams::Table, Teams::OwnerId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_teams_slug")
                    .table(Teams::Table)
                    .col(Teams::Slug)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // Team members table
        manager
            .create_table(
                Table::create()
                    .table(TeamMembers::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(TeamMembers::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(TeamMembers::TeamId).string().not_null())
                    .col(ColumnDef::new(TeamMembers::UserId).string().not_null())
                    .col(ColumnDef::new(TeamMembers::Role).string().not_null().default("ic"))
                    .col(ColumnDef::new(TeamMembers::JoinedAt).string().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(TeamMembers::Table, TeamMembers::TeamId)
                            .to(Teams::Table, Teams::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(TeamMembers::Table, TeamMembers::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_team_members_team_user")
                    .table(TeamMembers::Table)
                    .col(TeamMembers::TeamId)
                    .col(TeamMembers::UserId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // API keys table
        manager
            .create_table(
                Table::create()
                    .table(ApiKeys::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ApiKeys::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(ApiKeys::UserId).string().not_null())
                    .col(ColumnDef::new(ApiKeys::TeamId).string().not_null())
                    .col(ColumnDef::new(ApiKeys::Name).string().not_null())
                    .col(ColumnDef::new(ApiKeys::KeyHash).string().not_null())
                    .col(ColumnDef::new(ApiKeys::KeyPrefix).string().not_null())
                    .col(ColumnDef::new(ApiKeys::CreatedAt).string().not_null())
                    .col(ColumnDef::new(ApiKeys::LastUsedAt).string())
                    .col(ColumnDef::new(ApiKeys::RevokedAt).string())
                    .foreign_key(
                        ForeignKey::create()
                            .from(ApiKeys::Table, ApiKeys::UserId)
                            .to(Users::Table, Users::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ApiKeys::Table, ApiKeys::TeamId)
                            .to(Teams::Table, Teams::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_api_keys_hash")
                    .table(ApiKeys::Table)
                    .col(ApiKeys::KeyHash)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // Synced sessions table
        manager
            .create_table(
                Table::create()
                    .table(SyncedSessions::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(SyncedSessions::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(SyncedSessions::SessionId).string().not_null())
                    .col(ColumnDef::new(SyncedSessions::UserId).string().not_null())
                    .col(ColumnDef::new(SyncedSessions::TeamId).string())
                    .col(ColumnDef::new(SyncedSessions::ProjectPath).string().not_null())
                    .col(ColumnDef::new(SyncedSessions::EncryptedMessages).text().not_null())
                    .col(ColumnDef::new(SyncedSessions::EncryptedSummary).text())
                    .col(ColumnDef::new(SyncedSessions::MessageCount).integer().not_null().default(0))
                    .col(ColumnDef::new(SyncedSessions::Metadata).text())
                    .col(ColumnDef::new(SyncedSessions::CreatedAt).string().not_null())
                    .col(ColumnDef::new(SyncedSessions::UpdatedAt).string().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(SyncedSessions::Table, SyncedSessions::UserId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_synced_sessions_session_id")
                    .table(SyncedSessions::Table)
                    .col(SyncedSessions::SessionId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_synced_sessions_user")
                    .table(SyncedSessions::Table)
                    .col(SyncedSessions::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_synced_sessions_team")
                    .table(SyncedSessions::Table)
                    .col(SyncedSessions::TeamId)
                    .to_owned(),
            )
            .await?;

        // Team invites table
        manager
            .create_table(
                Table::create()
                    .table(TeamInvites::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(TeamInvites::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(TeamInvites::TeamId).string().not_null())
                    .col(ColumnDef::new(TeamInvites::InvitedBy).string().not_null())
                    .col(ColumnDef::new(TeamInvites::Email).string().not_null())
                    .col(ColumnDef::new(TeamInvites::Role).string().not_null().default("ic"))
                    .col(ColumnDef::new(TeamInvites::Token).string().not_null())
                    .col(ColumnDef::new(TeamInvites::Status).string().not_null().default("pending"))
                    .col(ColumnDef::new(TeamInvites::CreatedAt).string().not_null())
                    .col(ColumnDef::new(TeamInvites::ExpiresAt).string().not_null())
                    .col(ColumnDef::new(TeamInvites::AcceptedAt).string())
                    .foreign_key(
                        ForeignKey::create()
                            .from(TeamInvites::Table, TeamInvites::TeamId)
                            .to(Teams::Table, Teams::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(TeamInvites::Table, TeamInvites::InvitedBy)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_team_invites_token")
                    .table(TeamInvites::Table)
                    .col(TeamInvites::Token)
                    .unique()
                    .to_owned(),
            )
            .await?;

        // Encryption keys table
        manager
            .create_table(
                Table::create()
                    .table(EncryptionKeys::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(EncryptionKeys::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(EncryptionKeys::OwnerType).string().not_null())
                    .col(ColumnDef::new(EncryptionKeys::OwnerId).string().not_null())
                    .col(ColumnDef::new(EncryptionKeys::Version).integer().not_null().default(1))
                    .col(ColumnDef::new(EncryptionKeys::WrappedDek).text().not_null())
                    .col(ColumnDef::new(EncryptionKeys::WrapNonce).string().not_null())
                    .col(ColumnDef::new(EncryptionKeys::KekSalt).string().not_null())
                    .col(ColumnDef::new(EncryptionKeys::Algorithm).string().not_null().default("aes-256-gcm"))
                    .col(ColumnDef::new(EncryptionKeys::Active).boolean().not_null().default(true))
                    .col(ColumnDef::new(EncryptionKeys::CreatedAt).string().not_null())
                    .col(ColumnDef::new(EncryptionKeys::RotatedAt).string())
                    .col(ColumnDef::new(EncryptionKeys::ExpiresAt).string())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_encryption_keys_owner")
                    .table(EncryptionKeys::Table)
                    .col(EncryptionKeys::OwnerType)
                    .col(EncryptionKeys::OwnerId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_encryption_keys_active")
                    .table(EncryptionKeys::Table)
                    .col(EncryptionKeys::OwnerId)
                    .col(EncryptionKeys::Active)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(EncryptionKeys::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(TeamInvites::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(SyncedSessions::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(ApiKeys::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(TeamMembers::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Teams::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Users::Table).to_owned()).await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
    GithubId,
    GithubUsername,
    Email,
    DisplayName,
    AvatarUrl,
    Role,
    StripeCustomerId,
    SubscriptionId,
    SubscriptionStatus,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Teams {
    Table,
    Id,
    Name,
    Slug,
    OwnerId,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum TeamMembers {
    Table,
    Id,
    TeamId,
    UserId,
    Role,
    JoinedAt,
}

#[derive(DeriveIden)]
enum ApiKeys {
    Table,
    Id,
    UserId,
    TeamId,
    Name,
    KeyHash,
    KeyPrefix,
    CreatedAt,
    LastUsedAt,
    RevokedAt,
}

#[derive(DeriveIden)]
enum SyncedSessions {
    Table,
    Id,
    SessionId,
    UserId,
    TeamId,
    ProjectPath,
    EncryptedMessages,
    EncryptedSummary,
    MessageCount,
    Metadata,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum TeamInvites {
    Table,
    Id,
    TeamId,
    InvitedBy,
    Email,
    Role,
    Token,
    Status,
    CreatedAt,
    ExpiresAt,
    AcceptedAt,
}

#[derive(DeriveIden)]
enum EncryptionKeys {
    Table,
    Id,
    OwnerType,
    OwnerId,
    Version,
    WrappedDek,
    WrapNonce,
    KekSalt,
    Algorithm,
    Active,
    CreatedAt,
    RotatedAt,
    ExpiresAt,
}
