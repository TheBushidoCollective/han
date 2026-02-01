/**
 * Webhook Routes
 *
 * REST endpoints for handling external service webhooks.
 *
 * @description Stripe requires REST endpoints for webhooks (not GraphQL).
 * This module provides:
 * - POST /webhooks/stripe - Stripe webhook handler
 *
 * @security Implements replay protection via Redis event ID tracking
 */

import type { Context, Hono } from "hono";
import {
  getBillingService,
  handleWebhookEvent,
  verifyWebhookSignature,
} from "../billing/index.ts";
import { getRedisConnection } from "../db/index.ts";

/**
 * Get webhook secret from environment
 */
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
  }
  return secret;
}

/**
 * Handle Stripe webhook POST request
 *
 * @description
 * 1. Verifies the webhook signature using STRIPE_WEBHOOK_SECRET
 * 2. Processes the event using the billing service
 * 3. Returns appropriate HTTP status codes
 */
async function handleStripeWebhook(c: Context): Promise<Response> {
  try {
    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Get signature header
    const signature = c.req.header("stripe-signature");
    if (!signature) {
      console.warn("[Webhook] Missing stripe-signature header");
      return c.json({ error: "Missing signature" }, 400);
    }

    // Get webhook secret
    let webhookSecret: string;
    try {
      webhookSecret = getWebhookSecret();
    } catch {
      console.error("[Webhook] Webhook secret not configured");
      return c.json({ error: "Webhook not configured" }, 500);
    }

    // Verify signature and construct event
    const billingService = getBillingService();
    const stripe = billingService.getStripeClient();

    let event;
    try {
      event = verifyWebhookSignature(stripe, rawBody, signature, webhookSecret);
    } catch (err) {
      console.warn("[Webhook] Signature verification failed:", err);
      return c.json({ error: "Invalid signature" }, 400);
    }

    // Get Redis for replay protection
    let redis;
    try {
      redis = await getRedisConnection();
    } catch (redisError) {
      console.warn("[Webhook] Redis unavailable, proceeding without replay protection:", redisError);
    }

    // Process the event with replay protection
    const result = await handleWebhookEvent(billingService, event, redis);

    if (result.success) {
      return c.json({ received: true, message: result.message }, 200);
    } else {
      // Log error but return 200 to prevent Stripe retries for processing errors
      console.error("[Webhook] Processing error:", result.message);
      return c.json({ received: true, error: result.message }, 200);
    }
  } catch (error) {
    console.error("[Webhook] Unexpected error:", error);
    // Return 500 so Stripe will retry
    return c.json({ error: "Internal server error" }, 500);
  }
}

/**
 * Register webhook routes with Hono app
 *
 * @param app - Hono application instance
 */
export function registerWebhookRoutes(app: Hono) {
  // Stripe webhook endpoint
  // Note: This endpoint does NOT use authentication middleware
  // because Stripe signs requests with STRIPE_WEBHOOK_SECRET
  app.post("/webhooks/stripe", handleStripeWebhook);
}
