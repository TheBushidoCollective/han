//! Billing module: Stripe webhooks and plan management.

pub mod plans;
pub mod stripe;

#[cfg(test)]
mod tests {
    /// Verify that plan types and functions are accessible via the billing module.
    #[test]
    fn test_plan_types_accessible() {
        use super::plans::{map_stripe_status, PlanLimits, SubscriptionStatus, Tier};

        // Verify Tier enum variants and limits method
        let free_limits: PlanLimits = Tier::Free.limits();
        assert_eq!(free_limits.max_team_members, 1);
        assert!(!free_limits.encryption_enabled);

        let pro_limits = Tier::Pro.limits();
        assert_eq!(pro_limits.max_team_members, 25);
        assert!(pro_limits.encryption_enabled);

        let enterprise_limits = Tier::Enterprise.limits();
        assert!(enterprise_limits.encryption_enabled);
        assert!(enterprise_limits.max_synced_sessions > pro_limits.max_synced_sessions);

        // Verify from_subscription_status
        assert_eq!(
            Tier::from_subscription_status(SubscriptionStatus::Active),
            Tier::Pro
        );
        assert_eq!(
            Tier::from_subscription_status(SubscriptionStatus::Canceled),
            Tier::Free
        );

        // Verify map_stripe_status
        assert_eq!(map_stripe_status("active"), SubscriptionStatus::Active);
        assert_eq!(map_stripe_status("trialing"), SubscriptionStatus::Trialing);
        assert_eq!(map_stripe_status("past_due"), SubscriptionStatus::PastDue);
        assert_eq!(map_stripe_status("unpaid"), SubscriptionStatus::Unpaid);
        assert_eq!(map_stripe_status("canceled"), SubscriptionStatus::Canceled);
        assert_eq!(map_stripe_status("unknown_value"), SubscriptionStatus::None);

        // Verify Clone/Copy derives
        let tier = Tier::Pro;
        let copied = tier;
        assert_eq!(tier, copied);

        let status = SubscriptionStatus::Active;
        let cloned = status.clone();
        assert_eq!(status, cloned);
    }

    /// Verify that plan limits struct fields are accessible and Clone works.
    #[test]
    fn test_plan_limits_clone() {
        use super::plans::Tier;

        let limits = Tier::Pro.limits();
        let cloned = limits.clone();
        assert_eq!(cloned.max_team_members, limits.max_team_members);
        assert_eq!(cloned.max_synced_sessions, limits.max_synced_sessions);
        assert_eq!(cloned.max_api_keys, limits.max_api_keys);
        assert_eq!(cloned.retention_days, limits.retention_days);
        assert_eq!(cloned.encryption_enabled, limits.encryption_enabled);
    }

    /// Verify Tier serde serialization/deserialization.
    #[test]
    fn test_tier_serde() {
        use super::plans::Tier;

        let json = serde_json::to_string(&Tier::Pro).unwrap();
        assert_eq!(json, "\"pro\"");

        let tier: Tier = serde_json::from_str("\"free\"").unwrap();
        assert_eq!(tier, Tier::Free);

        let tier: Tier = serde_json::from_str("\"enterprise\"").unwrap();
        assert_eq!(tier, Tier::Enterprise);
    }

    /// Verify SubscriptionStatus serde serialization/deserialization.
    #[test]
    fn test_subscription_status_serde() {
        use super::plans::SubscriptionStatus;

        let json = serde_json::to_string(&SubscriptionStatus::Active).unwrap();
        assert_eq!(json, "\"active\"");

        let status: SubscriptionStatus = serde_json::from_str("\"past_due\"").unwrap();
        assert_eq!(status, SubscriptionStatus::PastDue);

        let status: SubscriptionStatus = serde_json::from_str("\"none\"").unwrap();
        assert_eq!(status, SubscriptionStatus::None);
    }

    /// Verify that Stripe webhook types are accessible via the billing module.
    #[test]
    fn test_stripe_types_accessible() {
        use super::stripe::{verify_signature, StripeEvent};

        // Verify StripeEvent can be deserialized
        let json = r#"{
            "id": "evt_test_123",
            "type": "customer.subscription.created",
            "data": {
                "object": {"customer": "cus_123", "status": "active"}
            }
        }"#;
        let event: StripeEvent = serde_json::from_str(json).unwrap();
        assert_eq!(event.id, "evt_test_123");
        assert_eq!(event.event_type, "customer.subscription.created");

        // Verify verify_signature is accessible and handles missing timestamp
        assert!(!verify_signature("payload", "v1=abc", "secret"));
    }
}
