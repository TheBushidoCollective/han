/**
 * Billing module exports
 *
 * @description Provides Stripe billing integration for the Han Team Platform.
 */

export {
  BillingService,
  getBillingService,
  initBillingService,
  resetBillingService,
  type BillingInfo,
  type BillingServiceConfig,
  type CheckoutSessionResult,
  type PriceInterval,
  type SubscriptionStatus,
  type UserTier,
} from "./billing-service.ts";

export {
  handleWebhookEvent,
  verifyWebhookSignature,
  isEventProcessed,
  markEventProcessed,
  type WebhookResult,
} from "./webhook-handler.ts";
