/**
 * Webhook Handler Tests
 *
 * Tests for Stripe webhook event processing.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import type Stripe from "stripe";
import type Redis from "ioredis";
import {
  handleWebhookEvent,
  verifyWebhookSignature,
  isEventProcessed,
  markEventProcessed,
} from "../lib/billing/webhook-handler.ts";
import type { BillingService } from "../lib/billing/billing-service.ts";

// Create mock billing service
function createMockBillingService(): BillingService {
  return {
    updateSubscriptionStatus: mock(() => Promise.resolve()),
    getUserIdByCustomerId: mock(() => Promise.resolve("user-123")),
    getStripeClient: mock(() => ({
      webhooks: {
        constructEvent: (payload: string, sig: string, secret: string) => {
          if (sig === "invalid") {
            throw new Error("Invalid signature");
          }
          return JSON.parse(payload);
        },
      },
    })),
  } as unknown as BillingService;
}

// Create mock Redis client for replay protection tests
function createMockRedis(): Redis {
  const storage = new Map<string, string>();

  return {
    exists: mock(async (key: string) => (storage.has(key) ? 1 : 0)),
    set: mock(async (key: string, value: string, ...args: string[]) => {
      // Handle NX flag
      if (args.includes("NX") && storage.has(key)) {
        return null;
      }
      storage.set(key, value);
      return "OK";
    }),
    get: mock(async (key: string) => storage.get(key) ?? null),
    del: mock(async (key: string) => {
      const existed = storage.has(key);
      storage.delete(key);
      return existed ? 1 : 0;
    }),
    // For testing purposes, expose storage
    _storage: storage,
  } as unknown as Redis & { _storage: Map<string, string> };
}

describe("Webhook Handler", () => {
  let mockBillingService: ReturnType<typeof createMockBillingService>;

  beforeEach(() => {
    mockBillingService = createMockBillingService();
  });

  describe("handleWebhookEvent", () => {
    describe("customer.subscription.created", () => {
      it("updates subscription status to active", async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "customer.subscription.created",
          data: {
            object: {
              id: "sub_123",
              customer: "cus_test",
              status: "active",
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            } as Stripe.Subscription,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(mockBillingService, event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Subscription created processed");
        expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "cus_test",
          "sub_123",
          "active",
          expect.any(Date)
        );
      });

      it("handles trialing status", async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "customer.subscription.created",
          data: {
            object: {
              id: "sub_123",
              customer: "cus_test",
              status: "trialing",
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 14,
            } as Stripe.Subscription,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(mockBillingService, event);

        expect(result.success).toBe(true);
        expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "cus_test",
          "sub_123",
          "trialing",
          expect.any(Date)
        );
      });
    });

    describe("customer.subscription.updated", () => {
      it("updates subscription status on change", async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "customer.subscription.updated",
          data: {
            object: {
              id: "sub_123",
              customer: "cus_test",
              status: "past_due",
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            } as Stripe.Subscription,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(mockBillingService, event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Subscription updated processed");
        expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "cus_test",
          "sub_123",
          "past_due",
          expect.any(Date)
        );
      });
    });

    describe("customer.subscription.deleted", () => {
      it("sets subscription status to canceled", async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "customer.subscription.deleted",
          data: {
            object: {
              id: "sub_123",
              customer: "cus_test",
              status: "canceled",
              current_period_end: Math.floor(Date.now() / 1000),
            } as Stripe.Subscription,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(mockBillingService, event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Subscription deleted processed");
        expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "cus_test",
          null,
          "canceled",
          null
        );
      });
    });

    describe("invoice.payment_failed", () => {
      it("logs payment failure", async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "invoice.payment_failed",
          data: {
            object: {
              id: "in_123",
              customer: "cus_test",
              amount_due: 2999,
            } as Stripe.Invoice,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(mockBillingService, event);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Invoice payment failed logged");
        expect(mockBillingService.getUserIdByCustomerId).toHaveBeenCalledWith(
          "cus_test"
        );
      });

      it("handles missing customer ID", async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "invoice.payment_failed",
          data: {
            object: {
              id: "in_123",
              customer: null,
              amount_due: 2999,
            } as unknown as Stripe.Invoice,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(mockBillingService, event);

        expect(result.success).toBe(true);
        expect(mockBillingService.getUserIdByCustomerId).not.toHaveBeenCalled();
      });
    });

    describe("unknown events", () => {
      it("acknowledges but does not process unknown events", async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "customer.created",
          data: {
            object: {
              id: "cus_test",
            } as Stripe.Customer,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(mockBillingService, event);

        expect(result.success).toBe(true);
        expect(result.message).toContain("acknowledged but not processed");
        // eventType is returned as a string for logging purposes
        expect(result.eventType as string).toBe("customer.created");
      });
    });

    describe("error handling", () => {
      it("returns failure result on processing error", async () => {
        const failingBillingService = {
          ...mockBillingService,
          updateSubscriptionStatus: mock(() => {
            throw new Error("Database connection failed");
          }),
        } as unknown as BillingService;

        const event: Stripe.Event = {
          id: "evt_test",
          type: "customer.subscription.created",
          data: {
            object: {
              id: "sub_123",
              customer: "cus_test",
              status: "active",
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            } as Stripe.Subscription,
          },
        } as Stripe.Event;

        const result = await handleWebhookEvent(failingBillingService, event);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Database connection failed");
      });
    });
  });

  describe("verifyWebhookSignature", () => {
    it("constructs event from valid signature", () => {
      const stripe = mockBillingService.getStripeClient();
      const payload = JSON.stringify({ type: "test" });

      const event = verifyWebhookSignature(
        stripe,
        payload,
        "valid_sig",
        "webhook_secret"
      );

      expect(event).toEqual({ type: "test" });
    });

    it("throws on invalid signature", () => {
      const stripe = mockBillingService.getStripeClient();
      const payload = JSON.stringify({ type: "test" });

      expect(() =>
        verifyWebhookSignature(stripe, payload, "invalid", "webhook_secret")
      ).toThrow("Invalid signature");
    });
  });

  describe("subscription status mapping", () => {
    const testCases: Array<{
      stripeStatus: string;
      expectedStatus: string;
    }> = [
      { stripeStatus: "trialing", expectedStatus: "trialing" },
      { stripeStatus: "active", expectedStatus: "active" },
      { stripeStatus: "past_due", expectedStatus: "past_due" },
      { stripeStatus: "canceled", expectedStatus: "canceled" },
      { stripeStatus: "unpaid", expectedStatus: "unpaid" },
      { stripeStatus: "incomplete", expectedStatus: "none" },
      { stripeStatus: "incomplete_expired", expectedStatus: "none" },
      { stripeStatus: "paused", expectedStatus: "none" },
    ];

    for (const { stripeStatus, expectedStatus } of testCases) {
      it(`maps Stripe status '${stripeStatus}' to '${expectedStatus}'`, async () => {
        const event: Stripe.Event = {
          id: "evt_test",
          type: "customer.subscription.updated",
          data: {
            object: {
              id: "sub_123",
              customer: "cus_test",
              status: stripeStatus as Stripe.Subscription.Status,
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            } as Stripe.Subscription,
          },
        } as Stripe.Event;

        await handleWebhookEvent(mockBillingService, event);

        expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "cus_test",
          "sub_123",
          expectedStatus,
          expect.any(Date)
        );
      });
    }
  });

  describe("customer ID extraction", () => {
    it("handles customer as string ID", async () => {
      const event: Stripe.Event = {
        id: "evt_test",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_string_id",
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      await handleWebhookEvent(mockBillingService, event);

      expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalledWith(
        "cus_string_id",
        "sub_123",
        "active",
        expect.any(Date)
      );
    });

    it("handles customer as expanded object", async () => {
      const event: Stripe.Event = {
        id: "evt_test",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: { id: "cus_object_id" } as Stripe.Customer,
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      await handleWebhookEvent(mockBillingService, event);

      expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalledWith(
        "cus_object_id",
        "sub_123",
        "active",
        expect.any(Date)
      );
    });
  });

  describe("replay protection", () => {
    it("processes event when not previously seen", async () => {
      const mockRedis = createMockRedis();
      const event: Stripe.Event = {
        id: "evt_replay_test_1",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_test",
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      const result = await handleWebhookEvent(mockBillingService, event, mockRedis);

      expect(result.success).toBe(true);
      expect(result.duplicate).toBeUndefined();
      expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalled();
    });

    it("rejects duplicate events", async () => {
      const mockRedis = createMockRedis();
      const eventId = "evt_replay_test_2";

      // Pre-mark as processed
      await markEventProcessed(mockRedis, eventId);

      const event: Stripe.Event = {
        id: eventId,
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_test",
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      const result = await handleWebhookEvent(mockBillingService, event, mockRedis);

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(result.message).toContain("already processed");
      // Should NOT call updateSubscriptionStatus for duplicates
      expect(mockBillingService.updateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it("marks event as processed before handling", async () => {
      const mockRedis = createMockRedis();
      const eventId = "evt_replay_test_3";

      const event: Stripe.Event = {
        id: eventId,
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_test",
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      await handleWebhookEvent(mockBillingService, event, mockRedis);

      // Event should now be marked as processed
      const isProcessed = await isEventProcessed(mockRedis, eventId);
      expect(isProcessed).toBe(true);
    });

    it("works without Redis (backwards compatibility)", async () => {
      const event: Stripe.Event = {
        id: "evt_no_redis",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_test",
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as Stripe.Subscription,
        },
      } as Stripe.Event;

      // Call without Redis parameter
      const result = await handleWebhookEvent(mockBillingService, event);

      expect(result.success).toBe(true);
      expect(result.duplicate).toBeUndefined();
      expect(mockBillingService.updateSubscriptionStatus).toHaveBeenCalled();
    });
  });
});
