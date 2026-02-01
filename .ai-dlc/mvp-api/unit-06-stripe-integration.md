---
status: completed
depends_on:
  - unit-01-auth-middleware
  - unit-05-stripe-terraform
branch: ai-dlc/mvp-api/06-stripe-integration
discipline: backend
---

# unit-06-stripe-integration

## Description

Implement Stripe billing integration: customer creation on signup, subscription management, webhook handling, and billing portal access.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `BillingService` class manages Stripe operations
- [ ] Stripe Customer created automatically when user signs up
- [ ] `stripe_customer_id` stored in users table
- [ ] `createCheckoutSession` mutation creates Stripe Checkout for PRO upgrade
- [ ] `billingPortalUrl` query returns Stripe billing portal URL
- [ ] `me.billing` field returns current subscription status
- [ ] `POST /webhooks/stripe` REST endpoint handles Stripe webhooks (required by Stripe)
- [ ] Webhook validates signature using `STRIPE_WEBHOOK_SECRET`
- [ ] `customer.subscription.created` → set user tier to PRO
- [ ] `customer.subscription.deleted` → set user tier to FREE
- [ ] `customer.subscription.updated` → update tier based on status
- [ ] `invoice.payment_failed` → send notification (log for MVP)
- [ ] Subscription status cached in Redis (5 min TTL)
- [ ] User tier accessible via GraphQL context
- [ ] Unit tests with mocked Stripe SDK

## Notes

**User tier logic:**
```typescript
type UserTier = 'free' | 'pro';

function getUserTier(user: User): UserTier {
  if (user.subscription_status === 'active') return 'pro';
  if (user.subscription_status === 'trialing') return 'pro';
  return 'free';
}
```

**File structure:**
```
lib/
  billing/
    billing-service.ts    # Stripe SDK wrapper
    webhook-handler.ts    # Webhook event processing
  graphql/
    types/
      billing.ts          # Billing types and mutations
    resolvers/
      billing-resolvers.ts
  routes/
    webhooks.ts           # Stripe webhook (REST - required by Stripe)
```

**Environment variables (from Terraform):**
- `STRIPE_API_KEY` - Secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- `STRIPE_PRO_MONTHLY_PRICE_ID` - Price ID for monthly PRO
- `STRIPE_PRO_YEARLY_PRICE_ID` - Price ID for yearly PRO

**Database changes:**
```sql
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'none';
ALTER TABLE users ADD COLUMN subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN current_period_end TIMESTAMP;
```
