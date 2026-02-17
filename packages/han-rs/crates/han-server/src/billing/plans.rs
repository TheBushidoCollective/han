//! Plan tier definitions and limits.

use serde::{Deserialize, Serialize};

/// User subscription tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Tier {
    Free,
    Pro,
    Enterprise,
}

/// Subscription status mapped from Stripe.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    None,
    Trialing,
    Active,
    PastDue,
    Canceled,
    Unpaid,
}

/// Plan limits for a tier.
#[derive(Debug, Clone)]
pub struct PlanLimits {
    /// Maximum team members.
    pub max_team_members: u32,
    /// Maximum synced sessions.
    pub max_synced_sessions: u32,
    /// Maximum API keys.
    pub max_api_keys: u32,
    /// Session data retention in days.
    pub retention_days: u32,
    /// Whether encryption is available.
    pub encryption_enabled: bool,
}

impl Tier {
    /// Get the limits for this tier.
    pub fn limits(&self) -> PlanLimits {
        match self {
            Tier::Free => PlanLimits {
                max_team_members: 1,
                max_synced_sessions: 10,
                max_api_keys: 1,
                retention_days: 7,
                encryption_enabled: false,
            },
            Tier::Pro => PlanLimits {
                max_team_members: 25,
                max_synced_sessions: 1000,
                max_api_keys: 10,
                retention_days: 90,
                encryption_enabled: true,
            },
            Tier::Enterprise => PlanLimits {
                max_team_members: u32::MAX,
                max_synced_sessions: u32::MAX,
                max_api_keys: 100,
                retention_days: 365,
                encryption_enabled: true,
            },
        }
    }

    /// Determine tier from subscription status.
    pub fn from_subscription_status(status: SubscriptionStatus) -> Self {
        match status {
            SubscriptionStatus::Active | SubscriptionStatus::Trialing => Tier::Pro,
            _ => Tier::Free,
        }
    }
}

/// Map a Stripe subscription status string to our enum.
pub fn map_stripe_status(status: &str) -> SubscriptionStatus {
    match status {
        "trialing" => SubscriptionStatus::Trialing,
        "active" => SubscriptionStatus::Active,
        "past_due" => SubscriptionStatus::PastDue,
        "canceled" => SubscriptionStatus::Canceled,
        "unpaid" => SubscriptionStatus::Unpaid,
        _ => SubscriptionStatus::None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_free_tier_limits() {
        let limits = Tier::Free.limits();
        assert_eq!(limits.max_team_members, 1);
        assert!(!limits.encryption_enabled);
    }

    #[test]
    fn test_pro_tier_limits() {
        let limits = Tier::Pro.limits();
        assert_eq!(limits.max_team_members, 25);
        assert!(limits.encryption_enabled);
    }

    #[test]
    fn test_tier_from_status() {
        assert_eq!(
            Tier::from_subscription_status(SubscriptionStatus::Active),
            Tier::Pro
        );
        assert_eq!(
            Tier::from_subscription_status(SubscriptionStatus::Trialing),
            Tier::Pro
        );
        assert_eq!(
            Tier::from_subscription_status(SubscriptionStatus::Canceled),
            Tier::Free
        );
        assert_eq!(
            Tier::from_subscription_status(SubscriptionStatus::None),
            Tier::Free
        );
    }

    #[test]
    fn test_map_stripe_status() {
        assert_eq!(map_stripe_status("active"), SubscriptionStatus::Active);
        assert_eq!(map_stripe_status("trialing"), SubscriptionStatus::Trialing);
        assert_eq!(map_stripe_status("past_due"), SubscriptionStatus::PastDue);
        assert_eq!(map_stripe_status("canceled"), SubscriptionStatus::Canceled);
        assert_eq!(map_stripe_status("unknown"), SubscriptionStatus::None);
        assert_eq!(
            map_stripe_status("incomplete"),
            SubscriptionStatus::None
        );
    }
}
