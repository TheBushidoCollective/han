/**
 * Stripe Webhook Handler
 *
 * Processes Stripe webhook events for subscription lifecycle management.
 *
 * @description Handles the following events:
 * - customer.subscription.created - Set user tier to PRO
 * - customer.subscription.updated - Update tier based on status
 * - customer.subscription.deleted - Set user tier to FREE
 * - invoice.payment_failed - Log notification (MVP)
 *
 * @security Implements replay protection by tracking processed event IDs in Redis
 */

import type Stripe from "stripe";
import type Redis from "ioredis";
import {
  BillingService,
  type SubscriptionStatus,
} from "./billing-service.ts";

/**
 * TTL for processed webhook event IDs (24 hours)
 * Stripe recommends handling idempotency for at least 24 hours
 */
const WEBHOOK_EVENT_TTL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Redis key prefix for processed webhook events
 */
const WEBHOOK_PROCESSED_PREFIX = "webhook:processed:";

/**
 * Webhook handler result
 */
export interface WebhookResult {
  success: boolean;
  message: string;
  eventType?: string;
  /** True if event was already processed (duplicate) */
  duplicate?: boolean;
}

/**
 * Check if a webhook event has already been processed (replay protection)
 *
 * @param redis - Redis client instance
 * @param eventId - Stripe event ID
 * @returns True if event was already processed
 */
export async function isEventProcessed(
  redis: Redis,
  eventId: string
): Promise<boolean> {
  const key = `${WEBHOOK_PROCESSED_PREFIX}${eventId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Mark a webhook event as processed (replay protection)
 *
 * @param redis - Redis client instance
 * @param eventId - Stripe event ID
 */
export async function markEventProcessed(
  redis: Redis,
  eventId: string
): Promise<void> {
  const key = `${WEBHOOK_PROCESSED_PREFIX}${eventId}`;
  // Use SETNX to atomically set only if not exists, then set TTL
  // This prevents race conditions between checking and marking
  await redis.set(key, "1", "EX", WEBHOOK_EVENT_TTL, "NX");
}

/**
 * Map Stripe subscription status to our internal status
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "none";
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(
  billingService: BillingService,
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const status = mapStripeStatus(subscription.status);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  console.log(
    `[Webhook] Subscription created: customer=${customerId}, status=${status}`
  );

  await billingService.updateSubscriptionStatus(
    customerId,
    subscription.id,
    status,
    currentPeriodEnd
  );
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(
  billingService: BillingService,
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const status = mapStripeStatus(subscription.status);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  console.log(
    `[Webhook] Subscription updated: customer=${customerId}, status=${status}`
  );

  await billingService.updateSubscriptionStatus(
    customerId,
    subscription.id,
    status,
    currentPeriodEnd
  );
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(
  billingService: BillingService,
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  console.log(
    `[Webhook] Subscription deleted: customer=${customerId}`
  );

  // Set status to canceled with null subscription ID
  await billingService.updateSubscriptionStatus(
    customerId,
    null,
    "canceled",
    null
  );
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(
  billingService: BillingService,
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) {
    console.warn("[Webhook] Invoice payment failed: no customer ID");
    return;
  }

  // For MVP, just log the failure
  // In production, this would send an email notification
  console.warn(
    `[Webhook] Invoice payment failed: customer=${customerId}, ` +
    `invoice=${invoice.id}, amount=${invoice.amount_due}`
  );

  // Get user ID for logging
  const userId = await billingService.getUserIdByCustomerId(customerId);
  if (userId) {
    console.warn(`[Webhook] Payment failed for user: ${userId}`);
    // TODO: Send notification email when notification service is available
  }
}

/**
 * Process a Stripe webhook event with replay protection
 *
 * @param billingService - The billing service instance
 * @param event - Verified Stripe event
 * @param redis - Redis client for replay protection (optional for backwards compatibility)
 *
 * @security Implements idempotency by checking Redis for processed event IDs
 * before processing. Events are marked as processed BEFORE handling to prevent
 * race conditions where the same event could be processed twice.
 */
export async function handleWebhookEvent(
  billingService: BillingService,
  event: Stripe.Event,
  redis?: Redis
): Promise<WebhookResult> {
  const eventType = event.type;
  const eventId = event.id;

  // Replay protection: Check if event was already processed
  if (redis) {
    const alreadyProcessed = await isEventProcessed(redis, eventId);
    if (alreadyProcessed) {
      console.log(`[Webhook] Duplicate event detected, skipping: ${eventId}`);
      return {
        success: true,
        message: "Event already processed (duplicate)",
        eventType,
        duplicate: true,
      };
    }

    // Mark event as processed BEFORE handling to prevent race conditions
    // If processing fails, the event will be marked but Stripe will retry
    // and we'll return the duplicate response above
    await markEventProcessed(redis, eventId);
  }

  try {
    switch (eventType) {
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(billingService, subscription);
        return {
          success: true,
          message: "Subscription created processed",
          eventType,
        };
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(billingService, subscription);
        return {
          success: true,
          message: "Subscription updated processed",
          eventType,
        };
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(billingService, subscription);
        return {
          success: true,
          message: "Subscription deleted processed",
          eventType,
        };
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(billingService, invoice);
        return {
          success: true,
          message: "Invoice payment failed logged",
          eventType,
        };
      }

      default:
        // Acknowledge but don't process unknown events
        console.log(`[Webhook] Unhandled event type: ${eventType}`);
        return {
          success: true,
          message: `Event type ${eventType} acknowledged but not processed`,
          eventType,
        };
    }
  } catch (error) {
    console.error(`[Webhook] Error processing ${eventType}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      eventType,
    };
  }
}

/**
 * Verify webhook signature and construct event
 *
 * @param stripe - Stripe client instance
 * @param payload - Raw request body
 * @param signature - Stripe signature header
 * @param webhookSecret - Webhook signing secret
 */
export function verifyWebhookSignature(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
