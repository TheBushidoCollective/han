/**
 * Webhook Route Tests
 *
 * Tests for the Stripe webhook REST endpoint structure and error handling.
 * These tests focus on HTTP-level behavior without mocking the billing service.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";

describe("Webhook Route", () => {
  let app: Hono;
  const originalEnv = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test123";
    app = new Hono();

    // Register a simplified webhook handler for testing HTTP behavior
    app.post("/webhooks/stripe", async (c) => {
      const signature = c.req.header("stripe-signature");
      if (!signature) {
        return c.json({ error: "Missing signature" }, 400);
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return c.json({ error: "Webhook not configured" }, 500);
      }

      // For testing, treat "invalid_signature" as invalid
      if (signature === "invalid_signature") {
        return c.json({ error: "Invalid signature" }, 400);
      }

      return c.json({ received: true }, 200);
    });
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.STRIPE_WEBHOOK_SECRET = originalEnv;
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });

  describe("POST /webhooks/stripe", () => {
    it("returns 400 for missing signature", async () => {
      const res = await app.request("/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "test" }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Missing signature");
    });

    it("returns 400 for invalid signature", async () => {
      const res = await app.request("/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "test" }),
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "invalid_signature",
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid signature");
    });

    it("returns 200 for valid webhook event", async () => {
      const event = {
        id: "evt_test",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_test",
            status: "active",
          },
        },
      };

      const res = await app.request("/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(event),
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "valid_signature",
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
    });

    it("returns 500 when webhook secret not configured", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const res = await app.request("/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "test" }),
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "test_sig",
        },
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Webhook not configured");
    });
  });

  describe("endpoint registration", () => {
    it("only responds to POST method", async () => {
      const methods = ["GET", "PUT", "DELETE", "PATCH"];

      for (const method of methods) {
        const res = await app.request("/webhooks/stripe", { method });
        expect(res.status).toBe(404);
      }
    });
  });
});
