/**
 * BillingService Tests
 *
 * Tests for Stripe billing integration with mocked Stripe SDK.
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import type { Pool, QueryResult } from "pg";
import type Redis from "ioredis";

// Mock Stripe SDK
const mockStripeCustomersCreate = mock(() =>
  Promise.resolve({ id: "cus_test123" })
);
const mockStripeCheckoutSessionsCreate = mock(() =>
  Promise.resolve({
    id: "cs_test123",
    url: "https://checkout.stripe.com/test",
  })
);
const mockStripeBillingPortalSessionsCreate = mock(() =>
  Promise.resolve({
    url: "https://billing.stripe.com/portal/test",
  })
);
const mockStripeWebhooksConstructEvent = mock((payload, signature, secret) => {
  if (signature === "invalid") {
    throw new Error("Invalid signature");
  }
  return JSON.parse(payload);
});

// Mock Stripe constructor
mock.module("stripe", () => ({
  default: class Stripe {
    customers = { create: mockStripeCustomersCreate };
    checkout = { sessions: { create: mockStripeCheckoutSessionsCreate } };
    billingPortal = { sessions: { create: mockStripeBillingPortalSessionsCreate } };
    webhooks = { constructEvent: mockStripeWebhooksConstructEvent };
  },
}));

import {
  BillingService,
  initBillingService,
  getBillingService,
  resetBillingService,
  type BillingServiceConfig,
} from "../lib/billing/billing-service.ts";

// Extended mock types
interface MockPool extends Pool {
  _setQueryResult: (pattern: string, result: Partial<QueryResult>) => void;
  _clearQueryResults: () => void;
}

interface MockRedis extends Redis {
  _clearCache: () => void;
}

// Mock database pool
function createMockDb(): MockPool {
  const queryResults: Map<string, Partial<QueryResult>> = new Map();

  const mockPool = {
    query: mock(async (sql: string, _params?: unknown[]): Promise<QueryResult> => {
      // Default empty result
      const defaultResult = { rows: [], rowCount: 0, command: "", oid: 0, fields: [] } as unknown as QueryResult;

      // Check if we have a registered result for this query pattern
      for (const [pattern, result] of queryResults.entries()) {
        if (sql.includes(pattern)) {
          return { ...defaultResult, ...result } as QueryResult;
        }
      }

      return defaultResult;
    }),
    // Helper to set up query results for tests
    _setQueryResult: (pattern: string, result: Partial<QueryResult>) => {
      queryResults.set(pattern, result);
    },
    _clearQueryResults: () => {
      queryResults.clear();
    },
  } as unknown as MockPool;

  return mockPool;
}

// Mock Redis client
function createMockRedis(): MockRedis {
  const cache: Map<string, string> = new Map();

  return {
    get: mock(async (key: string): Promise<string | null> => {
      return cache.get(key) ?? null;
    }),
    set: mock(async (key: string, value: string, ...args: string[]): Promise<string | null> => {
      // Handle NX (only set if not exists) and EX (expiry) flags
      const hasNX = args.includes("NX");
      if (hasNX && cache.has(key)) {
        return null; // Key exists, NX prevents overwrite
      }
      cache.set(key, value);
      return "OK";
    }),
    setex: mock(async (key: string, _ttl: number, value: string): Promise<"OK"> => {
      cache.set(key, value);
      return "OK";
    }),
    del: mock(async (key: string): Promise<number> => {
      const deleted = cache.has(key) ? 1 : 0;
      cache.delete(key);
      return deleted;
    }),
    eval: mock(async (script: string, numKeys: number, key: string, value: string): Promise<number> => {
      // Simple mock for the lock release Lua script
      if (cache.get(key) === value) {
        cache.delete(key);
        return 1;
      }
      return 0;
    }),
    expire: mock(async (_key: string, _ttl: number): Promise<number> => 1),
    ttl: mock(async (_key: string): Promise<number> => 30),
    incr: mock(async (key: string): Promise<number> => {
      const current = parseInt(cache.get(key) ?? "0", 10);
      const next = current + 1;
      cache.set(key, String(next));
      return next;
    }),
    exists: mock(async (key: string): Promise<number> => cache.has(key) ? 1 : 0),
    _clearCache: () => {
      cache.clear();
    },
  } as unknown as MockRedis;
}

const testConfig: BillingServiceConfig = {
  stripeApiKey: "test_billing_key_123",
  stripeProMonthlyPriceId: "price_monthly_123",
  stripeProYearlyPriceId: "price_yearly_123",
  appBaseUrl: "https://app.example.com",
};

describe("BillingService", () => {
  let mockDb: MockPool;
  let mockRedis: MockRedis;
  let billingService: BillingService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockRedis = createMockRedis();
    resetBillingService();
    billingService = new BillingService(mockDb, mockRedis, testConfig);
  });

  afterEach(() => {
    mockDb._clearQueryResults();
    mockRedis._clearCache();
    mockStripeCustomersCreate.mockClear();
    mockStripeCheckoutSessionsCreate.mockClear();
    mockStripeBillingPortalSessionsCreate.mockClear();
  });

  describe("getUserTier", () => {
    it("returns 'pro' for active subscription", () => {
      expect(BillingService.getUserTier("active")).toBe("pro");
    });

    it("returns 'pro' for trialing subscription", () => {
      expect(BillingService.getUserTier("trialing")).toBe("pro");
    });

    it("returns 'free' for no subscription", () => {
      expect(BillingService.getUserTier("none")).toBe("free");
    });

    it("returns 'free' for canceled subscription", () => {
      expect(BillingService.getUserTier("canceled")).toBe("free");
    });

    it("returns 'free' for past_due subscription", () => {
      expect(BillingService.getUserTier("past_due")).toBe("free");
    });

    it("returns 'free' for unpaid subscription", () => {
      expect(BillingService.getUserTier("unpaid")).toBe("free");
    });
  });

  describe("createCustomer", () => {
    it("creates a new Stripe customer and stores ID", async () => {
      // User has no existing customer ID
      mockDb._setQueryResult("SELECT stripe_customer_id", {
        rows: [{ stripe_customer_id: null }],
        rowCount: 1,
      } as QueryResult);

      // UPDATE query returns the updated row (atomic insert protection)
      mockDb._setQueryResult("UPDATE users", {
        rows: [{ stripe_customer_id: "cus_test123" }],
        rowCount: 1,
      } as QueryResult);

      const customerId = await billingService.createCustomer(
        "user-123",
        "test@example.com",
        "Test User"
      );

      expect(customerId).toBe("cus_test123");
      expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
        email: "test@example.com",
        name: "Test User",
        metadata: { userId: "user-123" },
      });
    });

    it("returns existing customer ID if already exists", async () => {
      mockDb._setQueryResult("SELECT stripe_customer_id", {
        rows: [{ stripe_customer_id: "cus_existing" }],
        rowCount: 1,
      } as QueryResult);

      const customerId = await billingService.createCustomer(
        "user-123",
        "test@example.com"
      );

      expect(customerId).toBe("cus_existing");
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });
  });

  describe("createCheckoutSession", () => {
    it("creates checkout session for monthly subscription", async () => {
      mockDb._setQueryResult("SELECT stripe_customer_id", {
        rows: [{ stripe_customer_id: "cus_test" }],
        rowCount: 1,
      } as QueryResult);

      const result = await billingService.createCheckoutSession(
        "user-123",
        "test@example.com",
        "monthly",
        "https://app.example.com/success",
        "https://app.example.com/cancel"
      );

      expect(result.sessionId).toBe("cs_test123");
      expect(result.url).toBe("https://checkout.stripe.com/test");
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_test",
          mode: "subscription",
          line_items: [{ price: "price_monthly_123", quantity: 1 }],
        })
      );
    });

    it("creates checkout session for yearly subscription", async () => {
      mockDb._setQueryResult("SELECT stripe_customer_id", {
        rows: [{ stripe_customer_id: "cus_test" }],
        rowCount: 1,
      } as QueryResult);

      const result = await billingService.createCheckoutSession(
        "user-123",
        "test@example.com",
        "yearly",
        "https://app.example.com/success",
        "https://app.example.com/cancel"
      );

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: "price_yearly_123", quantity: 1 }],
        })
      );
    });
  });

  describe("getBillingPortalUrl", () => {
    it("returns billing portal URL for existing customer", async () => {
      mockDb._setQueryResult("SELECT stripe_customer_id", {
        rows: [{ stripe_customer_id: "cus_test" }],
        rowCount: 1,
      } as QueryResult);

      const url = await billingService.getBillingPortalUrl(
        "user-123",
        "https://app.example.com/billing"
      );

      expect(url).toBe("https://billing.stripe.com/portal/test");
      expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: "cus_test",
        return_url: "https://app.example.com/billing",
      });
    });

    it("throws error for user without Stripe customer", async () => {
      mockDb._setQueryResult("SELECT stripe_customer_id", {
        rows: [{ stripe_customer_id: null }],
        rowCount: 1,
      } as QueryResult);

      await expect(
        billingService.getBillingPortalUrl("user-123", "https://example.com")
      ).rejects.toThrow("User does not have a Stripe customer account");
    });
  });

  describe("getBillingInfo", () => {
    it("returns billing info from database", async () => {
      const periodEnd = new Date("2024-02-01");
      mockDb._setQueryResult("SELECT", {
        rows: [
          {
            stripe_customer_id: "cus_test",
            subscription_id: "sub_123",
            subscription_status: "active",
            current_period_end: periodEnd,
          },
        ],
        rowCount: 1,
      } as QueryResult);

      const info = await billingService.getBillingInfo("user-123");

      expect(info).toEqual({
        tier: "pro",
        subscriptionStatus: "active",
        subscriptionId: "sub_123",
        currentPeriodEnd: periodEnd,
        stripeCustomerId: "cus_test",
      });
    });

    it("returns cached billing info on second call", async () => {
      const periodEnd = new Date("2024-02-01");
      mockDb._setQueryResult("SELECT", {
        rows: [
          {
            stripe_customer_id: "cus_test",
            subscription_id: "sub_123",
            subscription_status: "active",
            current_period_end: periodEnd,
          },
        ],
        rowCount: 1,
      } as QueryResult);

      // First call - hits database
      await billingService.getBillingInfo("user-123");

      // Second call - should use cache
      const info = await billingService.getBillingInfo("user-123");

      expect(info.tier).toBe("pro");
      expect((mockDb.query as ReturnType<typeof mock>).mock.calls.length).toBe(1);
    });

    it("defaults to 'none' for missing subscription status", async () => {
      mockDb._setQueryResult("SELECT", {
        rows: [
          {
            stripe_customer_id: null,
            subscription_id: null,
            subscription_status: null,
            current_period_end: null,
          },
        ],
        rowCount: 1,
      } as QueryResult);

      const info = await billingService.getBillingInfo("user-123");

      expect(info.tier).toBe("free");
      expect(info.subscriptionStatus).toBe("none");
    });
  });

  describe("updateSubscriptionStatus", () => {
    it("updates database and invalidates cache", async () => {
      mockDb._setQueryResult("UPDATE users", {
        rows: [{ id: "user-123" }],
        rowCount: 1,
      } as QueryResult);

      // Pre-populate cache
      await mockRedis.setex("billing:user-123", 300, JSON.stringify({ tier: "pro" }));

      await billingService.updateSubscriptionStatus(
        "cus_test",
        "sub_new",
        "active",
        new Date("2024-03-01")
      );

      // Verify cache was invalidated
      const cached = await mockRedis.get("billing:user-123");
      expect(cached).toBeNull();
    });
  });

  describe("singleton pattern", () => {
    it("throws if getBillingService called before init", () => {
      resetBillingService();
      expect(() => getBillingService()).toThrow(
        "BillingService not initialized"
      );
    });

    it("returns same instance after init", () => {
      resetBillingService();
      const instance = initBillingService(mockDb, mockRedis, testConfig);
      expect(getBillingService()).toBe(instance);
    });
  });
});
