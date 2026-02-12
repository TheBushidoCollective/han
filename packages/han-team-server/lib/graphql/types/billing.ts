/**
 * GraphQL Billing Types
 *
 * Types and mutations for Stripe billing integration.
 *
 * @description Provides:
 * - UserTier enum (free/pro)
 * - SubscriptionStatus enum
 * - BillingInfo object type
 * - createCheckoutSession mutation
 * - billingPortalUrl query
 * - User.billing field
 *
 * @security All redirect URLs are validated against APP_BASE_URL to prevent open redirects
 */

import {
  type BillingInfo,
  BillingService,
  getBillingService,
  type PriceInterval,
  type SubscriptionStatus,
  type UserTier,
} from '../../billing/index.ts';
import { getStripeConfig } from '../../config/schema.ts';
import { getRedisConnection } from '../../db/index.ts';
import { builder } from '../builder.ts';
import { UserTierEnum } from './user.ts';

/**
 * Rate limit configuration for billing mutations
 */
const BILLING_RATE_LIMIT = {
  /** Maximum checkout sessions per window */
  maxRequests: 10,
  /** Rate limit window in seconds (1 minute) */
  windowSeconds: 60,
  /** Redis key prefix */
  keyPrefix: 'rl:billing:checkout:',
};

/**
 * Check and enforce rate limit for billing mutations
 *
 * @security Prevents abuse by limiting checkout session creation to 10 per minute per user
 *
 * @param userId - User ID to rate limit
 * @throws Error if rate limit exceeded
 */
async function checkBillingRateLimit(userId: string): Promise<void> {
  const redis = await getRedisConnection();
  const key = `${BILLING_RATE_LIMIT.keyPrefix}${userId}`;

  // Use Redis INCR with TTL for atomic rate limiting
  const count = await redis.incr(key);

  // Set TTL on first request in window
  if (count === 1) {
    await redis.expire(key, BILLING_RATE_LIMIT.windowSeconds);
  }

  if (count > BILLING_RATE_LIMIT.maxRequests) {
    const ttl = await redis.ttl(key);
    throw new Error(
      `Rate limit exceeded for checkout sessions. Try again in ${ttl} seconds.`
    );
  }
}

/**
 * Validate that a redirect URL is safe (matches APP_BASE_URL domain)
 *
 * @security Prevents open redirect attacks by ensuring redirect URLs
 * belong to the same domain as the application
 *
 * @param url - URL to validate
 * @param appBaseUrl - Application base URL from config
 * @returns True if URL is safe to redirect to
 */
function isValidRedirectUrl(url: string, appBaseUrl: string): boolean {
  try {
    const redirectUrl = new URL(url);
    const baseUrl = new URL(appBaseUrl);

    // Check that the redirect URL uses the same origin as APP_BASE_URL
    // This prevents redirects to arbitrary external domains
    return redirectUrl.origin === baseUrl.origin;
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Subscription status enum type.
 *
 * @description Maps to Stripe subscription statuses plus 'none' for no subscription.
 */
export const SubscriptionStatusEnum = builder.enumType('SubscriptionStatus', {
  description: 'Stripe subscription status',
  values: {
    NONE: {
      value: 'none' as SubscriptionStatus,
      description: 'No subscription exists',
    },
    TRIALING: {
      value: 'trialing' as SubscriptionStatus,
      description: 'Subscription is in trial period',
    },
    ACTIVE: {
      value: 'active' as SubscriptionStatus,
      description: 'Subscription is active and paid',
    },
    PAST_DUE: {
      value: 'past_due' as SubscriptionStatus,
      description: 'Payment failed but subscription still active',
    },
    CANCELED: {
      value: 'canceled' as SubscriptionStatus,
      description: 'Subscription has been canceled',
    },
    UNPAID: {
      value: 'unpaid' as SubscriptionStatus,
      description: 'Subscription is unpaid and suspended',
    },
  },
});

/**
 * Price interval enum for checkout.
 */
export const PriceIntervalEnum = builder.enumType('PriceInterval', {
  description: 'Billing interval for subscription pricing',
  values: {
    MONTHLY: {
      value: 'monthly' as PriceInterval,
      description: 'Monthly billing cycle',
    },
    YEARLY: {
      value: 'yearly' as PriceInterval,
      description: 'Yearly billing cycle (typically discounted)',
    },
  },
});

/**
 * Billing info object reference.
 */
export const BillingInfoRef = builder.objectRef<BillingInfo>('BillingInfo');

/**
 * Billing info GraphQL type implementation.
 *
 * @description Contains all billing-related information for a user.
 */
export const BillingInfoType = BillingInfoRef.implement({
  description: "User's billing and subscription information",
  fields: (t) => ({
    tier: t.field({
      type: UserTierEnum,
      description: 'Current subscription tier (free or pro)',
      resolve: (info) => info.tier,
    }),
    subscriptionStatus: t.field({
      type: SubscriptionStatusEnum,
      description: 'Current Stripe subscription status',
      resolve: (info) => info.subscriptionStatus,
    }),
    subscriptionId: t.string({
      nullable: true,
      description: 'Stripe subscription ID if subscribed',
      resolve: (info) => info.subscriptionId,
    }),
    currentPeriodEnd: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'When the current billing period ends',
      resolve: (info) => info.currentPeriodEnd,
    }),
    hasPaymentMethod: t.boolean({
      description: 'Whether the user has a Stripe customer account',
      resolve: (info) => info.stripeCustomerId !== null,
    }),
  }),
});

/**
 * Checkout session result type.
 */
export const CheckoutSessionResultRef = builder.objectRef<{
  sessionId: string;
  url: string;
}>('CheckoutSessionResult');

export const CheckoutSessionResultType = CheckoutSessionResultRef.implement({
  description: 'Result of creating a Stripe Checkout session',
  fields: (t) => ({
    sessionId: t.exposeString('sessionId', {
      description: 'Stripe Checkout session ID',
    }),
    url: t.exposeString('url', {
      description: 'URL to redirect user to for checkout',
    }),
  }),
});

// =============================================================================
// Query Fields
// =============================================================================

/**
 * Billing portal URL query.
 *
 * @description Returns a URL for the Stripe billing portal where users can
 * manage their subscription, update payment methods, and view invoices.
 *
 * @security Validates returnUrl against APP_BASE_URL to prevent open redirects
 */
builder.queryField('billingPortalUrl', (t) =>
  t.string({
    nullable: true,
    description:
      'Get a URL to the Stripe billing portal for managing subscription. ' +
      'Requires authentication and an existing Stripe customer account. ' +
      'The returnUrl must match the application domain for security.',
    args: {
      returnUrl: t.arg.string({
        required: true,
        description:
          'URL to return to after leaving the billing portal (must match app domain)',
      }),
    },
    resolve: async (_parent, args, context) => {
      if (!context.user) {
        return null;
      }

      // Validate returnUrl to prevent open redirect attacks
      const stripeConfig = getStripeConfig();
      if (!isValidRedirectUrl(args.returnUrl, stripeConfig.appBaseUrl)) {
        console.warn(
          `[Billing] Invalid returnUrl rejected: ${args.returnUrl} (expected origin: ${stripeConfig.appBaseUrl})`
        );
        throw new Error('Invalid return URL: must match application domain');
      }

      try {
        const billingService = getBillingService();
        return await billingService.getBillingPortalUrl(
          context.user.id,
          args.returnUrl
        );
      } catch (error) {
        // User doesn't have a Stripe customer account
        console.warn('Failed to get billing portal URL:', error);
        return null;
      }
    },
  })
);

// =============================================================================
// Mutation Fields
// =============================================================================

/**
 * Create checkout session mutation.
 *
 * @description Creates a Stripe Checkout session for upgrading to PRO.
 * Returns a URL to redirect the user to complete payment.
 *
 * @security
 * - Validates successUrl and cancelUrl against APP_BASE_URL to prevent open redirects
 * - Rate limited to 10 requests per minute per user (via billing tier rate limiter)
 */
builder.mutationField('createCheckoutSession', (t) =>
  t.field({
    type: CheckoutSessionResultRef,
    nullable: true,
    description:
      'Create a Stripe Checkout session to upgrade to PRO subscription. ' +
      'Returns a URL to redirect the user to for payment. ' +
      'Success and cancel URLs must match the application domain. ' +
      'Rate limited to prevent abuse.',
    args: {
      interval: t.arg({
        type: PriceIntervalEnum,
        required: true,
        description: 'Billing interval (monthly or yearly)',
      }),
      successUrl: t.arg.string({
        required: true,
        description:
          'URL to redirect to after successful payment (must match app domain)',
      }),
      cancelUrl: t.arg.string({
        required: true,
        description:
          'URL to redirect to if user cancels checkout (must match app domain)',
      }),
    },
    resolve: async (_parent, args, context) => {
      if (!context.user) {
        return null;
      }

      // Rate limiting: Prevent checkout session abuse (10 per minute per user)
      await checkBillingRateLimit(context.user.id);

      // Validate redirect URLs to prevent open redirect attacks
      const stripeConfig = getStripeConfig();
      if (!isValidRedirectUrl(args.successUrl, stripeConfig.appBaseUrl)) {
        console.warn(
          `[Billing] Invalid successUrl rejected: ${args.successUrl} (expected origin: ${stripeConfig.appBaseUrl})`
        );
        throw new Error('Invalid success URL: must match application domain');
      }
      if (!isValidRedirectUrl(args.cancelUrl, stripeConfig.appBaseUrl)) {
        console.warn(
          `[Billing] Invalid cancelUrl rejected: ${args.cancelUrl} (expected origin: ${stripeConfig.appBaseUrl})`
        );
        throw new Error('Invalid cancel URL: must match application domain');
      }

      try {
        const billingService = getBillingService();
        const result = await billingService.createCheckoutSession(
          context.user.id,
          context.user.email,
          args.interval as PriceInterval,
          args.successUrl,
          args.cancelUrl
        );

        return result;
      } catch (error) {
        console.error('Failed to create checkout session:', error);
        throw new Error('Failed to create checkout session');
      }
    },
  })
);

// =============================================================================
// User.billing Field Extension
// =============================================================================

// Note: This needs to be added to the User type.
// Since User type is defined separately, we'll add this as an extension.
// This is typically done by importing the UserRef and adding a field.

import { UserRef } from './user.ts';

/**
 * Add billing field to User type.
 *
 * @description Returns the user's billing information including tier and subscription status.
 */
builder.objectField(UserRef, 'billing', (t) =>
  t.field({
    type: BillingInfoRef,
    nullable: true,
    description: "User's billing and subscription information",
    resolve: async (user, _args, _context) => {
      try {
        const billingService = getBillingService();
        return await billingService.getBillingInfo(user.id);
      } catch (error) {
        console.warn('Failed to get billing info:', error);
        return null;
      }
    },
  })
);

// Note: User.tier field is defined in user.ts - do not duplicate here
