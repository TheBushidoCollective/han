/**
 * Billing GraphQL Schema Tests
 *
 * Tests for billing-related GraphQL types and schema structure.
 * These tests verify the schema includes all required types, fields,
 * and mutations without requiring mocked services.
 */

import { describe, it, expect } from "bun:test";
import { printSchema, graphql } from "graphql";
import { schema } from "../lib/graphql/schema.ts";

describe("Billing GraphQL Types", () => {
  describe("schema introspection", () => {
    it("includes UserTier enum", () => {
      const sdl = printSchema(schema);
      expect(sdl).toContain("enum UserTier");
      expect(sdl).toContain("FREE");
      expect(sdl).toContain("PRO");
    });

    it("includes SubscriptionStatus enum", () => {
      const sdl = printSchema(schema);
      expect(sdl).toContain("enum SubscriptionStatus");
      expect(sdl).toContain("NONE");
      expect(sdl).toContain("TRIALING");
      expect(sdl).toContain("ACTIVE");
      expect(sdl).toContain("PAST_DUE");
      expect(sdl).toContain("CANCELED");
      expect(sdl).toContain("UNPAID");
    });

    it("includes PriceInterval enum", () => {
      const sdl = printSchema(schema);
      expect(sdl).toContain("enum PriceInterval");
      expect(sdl).toContain("MONTHLY");
      expect(sdl).toContain("YEARLY");
    });

    it("includes BillingInfo type", () => {
      const sdl = printSchema(schema);
      expect(sdl).toContain("type BillingInfo");
      expect(sdl).toContain("tier: UserTier");
      expect(sdl).toContain("subscriptionStatus: SubscriptionStatus");
      expect(sdl).toContain("subscriptionId: String");
      expect(sdl).toContain("currentPeriodEnd: DateTime");
      expect(sdl).toContain("hasPaymentMethod: Boolean");
    });

    it("includes CheckoutSessionResult type", () => {
      const sdl = printSchema(schema);
      expect(sdl).toContain("type CheckoutSessionResult");
      expect(sdl).toContain("sessionId: String");
      expect(sdl).toContain("url: String");
    });

    it("adds billing field to User type", () => {
      const sdl = printSchema(schema);
      // Check User type has billing field
      const userTypeMatch = sdl.match(/type User \{[\s\S]*?\}/);
      expect(userTypeMatch).toBeTruthy();
      if (userTypeMatch) {
        expect(userTypeMatch[0]).toContain("billing: BillingInfo");
        expect(userTypeMatch[0]).toContain("tier: UserTier");
      }
    });

    it("includes billingPortalUrl query", () => {
      const sdl = printSchema(schema);
      expect(sdl).toContain("billingPortalUrl");
      expect(sdl).toContain("returnUrl: String!");
    });

    it("includes createCheckoutSession mutation", () => {
      const sdl = printSchema(schema);
      expect(sdl).toContain("createCheckoutSession(");
      expect(sdl).toContain("interval: PriceInterval!");
      expect(sdl).toContain("successUrl: String!");
      expect(sdl).toContain("cancelUrl: String!");
      expect(sdl).toContain("): CheckoutSessionResult");
    });
  });

  describe("query: billingPortalUrl", () => {
    it("returns null when not authenticated", async () => {
      const query = `
        query {
          billingPortalUrl(returnUrl: "https://example.com")
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        contextValue: {
          db: {},
          env: "development",
          user: null,
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.billingPortalUrl).toBeNull();
    });
  });

  describe("mutation: createCheckoutSession", () => {
    it("returns null when not authenticated", async () => {
      const mutation = `
        mutation {
          createCheckoutSession(
            interval: MONTHLY
            successUrl: "https://example.com/success"
            cancelUrl: "https://example.com/cancel"
          ) {
            sessionId
            url
          }
        }
      `;

      const result = await graphql({
        schema,
        source: mutation,
        contextValue: {
          db: {},
          env: "development",
          user: null,
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.createCheckoutSession).toBeNull();
    });
  });

  describe("type descriptions", () => {
    it("has descriptions for all billing types", () => {
      const sdl = printSchema(schema);

      // Check for descriptions (they appear before type definitions)
      expect(sdl).toContain('"User subscription tier');
      expect(sdl).toContain('"Stripe subscription status');
      expect(sdl).toContain('"Billing interval');
      expect(sdl).toContain("User's billing and subscription information");
    });
  });
});
