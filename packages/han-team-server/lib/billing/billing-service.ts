/**
 * Billing Service - Stripe SDK Wrapper
 *
 * Manages all Stripe billing operations for the Han Team Platform.
 *
 * @description This service provides:
 * - Stripe customer creation and management
 * - Checkout session creation for subscription upgrades
 * - Billing portal URL generation
 * - Subscription status retrieval with Redis caching
 */

import Stripe from "stripe";
import type { Pool } from "pg";
import type Redis from "ioredis";

/**
 * User tier based on subscription status
 */
export type UserTier = "free" | "pro";

/**
 * Subscription status values matching Stripe + our 'none' default
 */
export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

/**
 * Billing information returned to clients
 */
export interface BillingInfo {
  tier: UserTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionId: string | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
}

/**
 * Checkout session result
 */
export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

/**
 * Price interval for subscription
 */
export type PriceInterval = "monthly" | "yearly";

/**
 * Configuration for the billing service
 */
export interface BillingServiceConfig {
  stripeApiKey: string;
  stripeProMonthlyPriceId: string;
  stripeProYearlyPriceId: string;
  appBaseUrl: string;
}

/**
 * Cache TTL for subscription status (5 minutes)
 */
const SUBSCRIPTION_CACHE_TTL = 300;

/**
 * BillingService - Stripe SDK wrapper for all billing operations
 */
export class BillingService {
  private stripe: Stripe;
  private db: Pool;
  private redis: Redis;
  private config: BillingServiceConfig;

  constructor(db: Pool, redis: Redis, config: BillingServiceConfig) {
    this.db = db;
    this.redis = redis;
    this.config = config;
    this.stripe = new Stripe(config.stripeApiKey, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }

  /**
   * Get the Stripe SDK instance (for webhook verification)
   */
  getStripeClient(): Stripe {
    return this.stripe;
  }

  /**
   * Get user tier from subscription status
   */
  static getUserTier(subscriptionStatus: SubscriptionStatus): UserTier {
    if (subscriptionStatus === "active") return "pro";
    if (subscriptionStatus === "trialing") return "pro";
    return "free";
  }

  /**
   * Create a Stripe customer for a user with race condition protection
   *
   * @security Uses Redis lock to prevent duplicate customer creation in concurrent requests
   *
   * @param userId - Database user ID
   * @param email - User's email address
   * @param name - User's display name (optional)
   * @returns Stripe customer ID
   */
  async createCustomer(
    userId: string,
    email: string,
    name?: string
  ): Promise<string> {
    // Acquire Redis lock to prevent race condition
    const lockKey = `lock:stripe_customer:${userId}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    const lockTTL = 30; // 30 second lock timeout

    // Try to acquire lock atomically (SET NX EX)
    const lockAcquired = await this.redis.set(lockKey, lockValue, "EX", lockTTL, "NX");

    if (!lockAcquired) {
      // Another request is creating customer, wait and check for result
      console.log(`[Billing] Waiting for customer creation lock for user: ${userId}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if customer was created by concurrent request
      const result = await this.db.query(
        "SELECT stripe_customer_id FROM users WHERE id = $1",
        [userId]
      );
      if (result.rows[0]?.stripe_customer_id) {
        return result.rows[0].stripe_customer_id;
      }

      throw new Error("Failed to create Stripe customer: lock timeout");
    }

    try {
      // Double-check inside lock - another request may have completed just before we acquired
      const existingResult = await this.db.query(
        "SELECT stripe_customer_id FROM users WHERE id = $1",
        [userId]
      );

      if (existingResult.rows[0]?.stripe_customer_id) {
        return existingResult.rows[0].stripe_customer_id;
      }

      // Create Stripe customer
      const customer = await this.stripe.customers.create({
        email,
        name: name ?? undefined,
        metadata: {
          userId,
        },
      });

      // Store customer ID in database atomically using UPDATE ... WHERE
      // Only update if stripe_customer_id is still null (prevents race with concurrent request)
      const updateResult = await this.db.query(
        `UPDATE users
         SET stripe_customer_id = $1
         WHERE id = $2 AND stripe_customer_id IS NULL
         RETURNING stripe_customer_id`,
        [customer.id, userId]
      );

      if (updateResult.rows.length === 0) {
        // Another concurrent request set the customer ID - fetch what they set
        const fetchResult = await this.db.query(
          "SELECT stripe_customer_id FROM users WHERE id = $1",
          [userId]
        );
        if (fetchResult.rows[0]?.stripe_customer_id) {
          // Delete the duplicate customer we just created in Stripe
          console.warn(`[Billing] Duplicate customer created, cleaning up: ${customer.id}`);
          try {
            await this.stripe.customers.del(customer.id);
          } catch (delError) {
            console.error("[Billing] Failed to delete duplicate customer:", delError);
          }
          return fetchResult.rows[0].stripe_customer_id;
        }
        throw new Error("Failed to store Stripe customer ID");
      }

      return customer.id;
    } finally {
      // Release lock only if we still hold it (using Lua script for atomicity)
      const releaseLockScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.eval(releaseLockScript, 1, lockKey, lockValue);
    }
  }

  /**
   * Get or create Stripe customer for a user
   *
   * @security Delegates to createCustomer which uses Redis lock for race condition protection
   */
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name?: string
  ): Promise<string> {
    const result = await this.db.query(
      "SELECT stripe_customer_id FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows[0]?.stripe_customer_id) {
      return result.rows[0].stripe_customer_id;
    }

    return this.createCustomer(userId, email, name);
  }

  /**
   * Create a Stripe Checkout session for PRO subscription
   *
   * @param userId - Database user ID
   * @param email - User's email address
   * @param interval - Billing interval (monthly or yearly)
   * @param successUrl - URL to redirect on success
   * @param cancelUrl - URL to redirect on cancel
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    interval: PriceInterval,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    // Get or create Stripe customer
    const customerId = await this.getOrCreateCustomer(userId, email);

    // Select price ID based on interval
    const priceId =
      interval === "yearly"
        ? this.config.stripeProYearlyPriceId
        : this.config.stripeProMonthlyPriceId;

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          userId,
        },
      },
      metadata: {
        userId,
      },
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session URL");
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Get Stripe billing portal URL for managing subscription
   *
   * @param userId - Database user ID
   * @param returnUrl - URL to return to after portal session
   */
  async getBillingPortalUrl(
    userId: string,
    returnUrl: string
  ): Promise<string> {
    // Get customer ID from database
    const result = await this.db.query(
      "SELECT stripe_customer_id FROM users WHERE id = $1",
      [userId]
    );

    const customerId = result.rows[0]?.stripe_customer_id;
    if (!customerId) {
      throw new Error("User does not have a Stripe customer account");
    }

    // Create billing portal session
    const portalSession = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return portalSession.url;
  }

  /**
   * Get billing info for a user with Redis caching
   *
   * @param userId - Database user ID
   */
  async getBillingInfo(userId: string): Promise<BillingInfo> {
    // Check Redis cache first
    const cacheKey = `billing:${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached);
      // Restore Date object
      if (parsed.currentPeriodEnd) {
        parsed.currentPeriodEnd = new Date(parsed.currentPeriodEnd);
      }
      return parsed as BillingInfo;
    }

    // Query database
    const result = await this.db.query(
      `SELECT
        stripe_customer_id,
        subscription_id,
        subscription_status,
        current_period_end
      FROM users WHERE id = $1`,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("User not found");
    }

    const subscriptionStatus: SubscriptionStatus =
      (row.subscription_status as SubscriptionStatus) || "none";

    const billingInfo: BillingInfo = {
      tier: BillingService.getUserTier(subscriptionStatus),
      subscriptionStatus,
      subscriptionId: row.subscription_id,
      currentPeriodEnd: row.current_period_end
        ? new Date(row.current_period_end)
        : null,
      stripeCustomerId: row.stripe_customer_id,
    };

    // Cache the result
    await this.redis.setex(
      cacheKey,
      SUBSCRIPTION_CACHE_TTL,
      JSON.stringify(billingInfo)
    );

    return billingInfo;
  }

  /**
   * Update subscription status in database and invalidate cache
   *
   * @param stripeCustomerId - Stripe customer ID
   * @param subscriptionId - Stripe subscription ID
   * @param status - New subscription status
   * @param currentPeriodEnd - Subscription period end date
   */
  async updateSubscriptionStatus(
    stripeCustomerId: string,
    subscriptionId: string | null,
    status: SubscriptionStatus,
    currentPeriodEnd: Date | null
  ): Promise<void> {
    // Update database
    const result = await this.db.query(
      `UPDATE users
       SET subscription_id = $1,
           subscription_status = $2,
           current_period_end = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE stripe_customer_id = $4
       RETURNING id`,
      [subscriptionId, status, currentPeriodEnd, stripeCustomerId]
    );

    // Invalidate cache
    if (result.rows[0]?.id) {
      const cacheKey = `billing:${result.rows[0].id}`;
      await this.redis.del(cacheKey);
    }
  }

  /**
   * Get user ID by Stripe customer ID
   */
  async getUserIdByCustomerId(stripeCustomerId: string): Promise<string | null> {
    const result = await this.db.query(
      "SELECT id FROM users WHERE stripe_customer_id = $1",
      [stripeCustomerId]
    );
    return result.rows[0]?.id ?? null;
  }

  /**
   * Invalidate billing cache for a user
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `billing:${userId}`;
    await this.redis.del(cacheKey);
  }
}

/**
 * Singleton instance
 */
let billingServiceInstance: BillingService | null = null;

/**
 * Get billing service singleton
 */
export function getBillingService(): BillingService {
  if (!billingServiceInstance) {
    throw new Error(
      "BillingService not initialized. Call initBillingService first."
    );
  }
  return billingServiceInstance;
}

/**
 * Initialize billing service singleton
 */
export function initBillingService(
  db: Pool,
  redis: Redis,
  config: BillingServiceConfig
): BillingService {
  billingServiceInstance = new BillingService(db, redis, config);
  return billingServiceInstance;
}

/**
 * Reset billing service singleton (for testing)
 */
export function resetBillingService(): void {
  billingServiceInstance = null;
}
