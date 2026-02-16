//! Stripe webhook handler with signature verification.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use hmac::{Hmac, Mac};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use sha2::Sha256;
use serde_json::json;
use tracing::{error, info, warn};

use super::plans::map_stripe_status;
use crate::state::AppState;

type HmacSha256 = Hmac<Sha256>;

/// Stripe webhook event (simplified).
#[derive(Debug, serde::Deserialize)]
pub struct StripeEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: StripeEventData,
}

#[derive(Debug, serde::Deserialize)]
pub struct StripeEventData {
    pub object: serde_json::Value,
}

/// Handle incoming Stripe webhook.
pub async fn webhook_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> impl IntoResponse {
    // Verify signature
    let signature = match headers.get("stripe-signature").and_then(|v| v.to_str().ok()) {
        Some(sig) => sig.to_string(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "missing stripe-signature header"})),
            );
        }
    };

    if !verify_signature(&body, &signature, &state.config.stripe_webhook_secret) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid signature"})),
        );
    }

    // Parse event
    let event: StripeEvent = match serde_json::from_str(&body) {
        Ok(e) => e,
        Err(e) => {
            error!("Failed to parse Stripe event: {e}");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid event payload"})),
            );
        }
    };

    info!(event_id = %event.id, event_type = %event.event_type, "Processing Stripe webhook");

    // Process event
    match event.event_type.as_str() {
        "customer.subscription.created" | "customer.subscription.updated" => {
            if let Err(e) = handle_subscription_change(&state.db, &event.data.object).await {
                error!("Failed to handle subscription change: {e}");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "failed to process event"})),
                );
            }
        }
        "customer.subscription.deleted" => {
            if let Err(e) = handle_subscription_deleted(&state.db, &event.data.object).await {
                error!("Failed to handle subscription deletion: {e}");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "failed to process event"})),
                );
            }
        }
        "invoice.payment_failed" => {
            handle_payment_failed(&event.data.object);
        }
        _ => {
            info!(event_type = %event.event_type, "Ignoring unhandled Stripe event type");
        }
    }

    (StatusCode::OK, Json(json!({"received": true})))
}

/// Verify Stripe webhook signature using HMAC-SHA256.
pub fn verify_signature(payload: &str, signature_header: &str, secret: &str) -> bool {
    // Parse signature header: t=timestamp,v1=signature
    let mut timestamp = None;
    let mut signatures = Vec::new();

    for part in signature_header.split(',') {
        let part = part.trim();
        if let Some(ts) = part.strip_prefix("t=") {
            timestamp = Some(ts.to_string());
        } else if let Some(sig) = part.strip_prefix("v1=") {
            signatures.push(sig.to_string());
        }
    }

    let timestamp = match timestamp {
        Some(ts) => ts,
        None => return false,
    };

    if signatures.is_empty() {
        return false;
    }

    // Compute expected signature
    let signed_payload = format!("{timestamp}.{payload}");
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(mac) => mac,
        Err(_) => return false,
    };
    mac.update(signed_payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    // Constant-time comparison
    signatures.iter().any(|sig| constant_time_eq(sig, &expected))
}

/// Constant-time string comparison to prevent timing attacks.
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}

/// Handle subscription created/updated events.
async fn handle_subscription_change(
    db: &DatabaseConnection,
    object: &serde_json::Value,
) -> Result<(), String> {
    use han_db::entities::users;

    let customer_id = object["customer"]
        .as_str()
        .ok_or("missing customer ID")?;
    let status_str = object["status"]
        .as_str()
        .ok_or("missing subscription status")?;
    let subscription_id = object["id"]
        .as_str()
        .ok_or("missing subscription ID")?;

    let status = map_stripe_status(status_str);

    info!(
        customer_id,
        subscription_id,
        ?status,
        "Updating subscription"
    );

    // Find user by stripe_customer_id
    let user = users::Entity::find()
        .filter(users::Column::StripeCustomerId.eq(customer_id))
        .one(db)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("No user found for Stripe customer {customer_id}"))?;

    // Update subscription info
    let mut active: users::ActiveModel = user.into();
    active.subscription_id = Set(Some(subscription_id.to_string()));
    active.subscription_status = Set(Some(status_str.to_string()));

    users::Entity::update(active)
        .exec(db)
        .await
        .map_err(|e| format!("Failed to update user: {e}"))?;

    Ok(())
}

/// Handle subscription deleted event.
async fn handle_subscription_deleted(
    db: &DatabaseConnection,
    object: &serde_json::Value,
) -> Result<(), String> {
    use han_db::entities::users;

    let customer_id = object["customer"]
        .as_str()
        .ok_or("missing customer ID")?;

    info!(customer_id, "Subscription deleted");

    let user = users::Entity::find()
        .filter(users::Column::StripeCustomerId.eq(customer_id))
        .one(db)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .ok_or_else(|| format!("No user found for Stripe customer {customer_id}"))?;

    let mut active: users::ActiveModel = user.into();
    active.subscription_id = Set(None);
    active.subscription_status = Set(Some("canceled".to_string()));

    users::Entity::update(active)
        .exec(db)
        .await
        .map_err(|e| format!("Failed to update user: {e}"))?;

    Ok(())
}

/// Handle invoice payment failed event (log only).
fn handle_payment_failed(object: &serde_json::Value) {
    let customer_id = object["customer"].as_str().unwrap_or("unknown");
    let invoice_id = object["id"].as_str().unwrap_or("unknown");
    let amount = object["amount_due"].as_i64().unwrap_or(0);

    warn!(
        customer_id,
        invoice_id,
        amount,
        "Invoice payment failed"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_signature_valid() {
        let secret = "whsec_test123";
        let payload = r#"{"id":"evt_test"}"#;
        let timestamp = "1234567890";

        // Compute expected signature
        let signed = format!("{timestamp}.{payload}");
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());

        let header = format!("t={timestamp},v1={sig}");
        assert!(verify_signature(payload, &header, secret));
    }

    #[test]
    fn test_verify_signature_invalid() {
        let header = "t=123,v1=invalid_signature_hex_value_that_is_definitely_wrong_here";
        assert!(!verify_signature("payload", header, "secret"));
    }

    #[test]
    fn test_verify_signature_missing_timestamp() {
        assert!(!verify_signature("payload", "v1=abc", "secret"));
    }

    #[test]
    fn test_verify_signature_missing_v1() {
        assert!(!verify_signature("payload", "t=123", "secret"));
    }

    #[test]
    fn test_constant_time_eq() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "ab"));
    }

    #[test]
    fn test_map_stripe_status_in_webhook() {
        // Test the mapping function used in webhook processing
        let status = map_stripe_status("active");
        assert_eq!(status, super::super::plans::SubscriptionStatus::Active);
    }
}
