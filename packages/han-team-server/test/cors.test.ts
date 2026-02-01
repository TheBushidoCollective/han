/**
 * CORS Middleware Tests
 *
 * Tests for the CORS middleware configuration.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import {
  cors,
  defaultCors,
  developmentCors,
  productionCors,
  CORS_CONFIG,
} from "../lib/middleware/cors.ts";

describe("CORS Configuration", () => {
  describe("CORS_CONFIG defaults", () => {
    test("should allow localhost on any port", () => {
      const localhostPattern = CORS_CONFIG.origins.find(
        (o) => o instanceof RegExp && o.source.includes("localhost")
      ) as RegExp;

      expect(localhostPattern).toBeDefined();
      expect(localhostPattern.test("http://localhost:3000")).toBe(true);
      expect(localhostPattern.test("http://localhost:8080")).toBe(true);
      expect(localhostPattern.test("http://localhost:41956")).toBe(true);
    });

    test("should allow 127.0.0.1 on any port", () => {
      const ipPattern = CORS_CONFIG.origins.find(
        (o) => o instanceof RegExp && o.source.includes("127\\.0\\.0\\.1")
      ) as RegExp;

      expect(ipPattern).toBeDefined();
      expect(ipPattern.test("http://127.0.0.1:3000")).toBe(true);
      expect(ipPattern.test("http://127.0.0.1:8080")).toBe(true);
    });

    test("should allow production domains", () => {
      const productionDomains = CORS_CONFIG.origins.filter(
        (o) => typeof o === "string"
      );

      expect(productionDomains).toContain("https://han.guru");
      expect(productionDomains).toContain("https://app.han.guru");
      expect(productionDomains).toContain("https://team.han.guru");
      expect(productionDomains).toContain("https://www.han.guru");
    });

    test("should enable credentials", () => {
      expect(CORS_CONFIG.credentials).toBe(true);
    });

    test("should allow required HTTP methods", () => {
      expect(CORS_CONFIG.methods).toContain("GET");
      expect(CORS_CONFIG.methods).toContain("POST");
      expect(CORS_CONFIG.methods).toContain("PATCH");
      expect(CORS_CONFIG.methods).toContain("DELETE");
      expect(CORS_CONFIG.methods).toContain("OPTIONS");
      expect(CORS_CONFIG.methods).toContain("PUT");
    });

    test("should allow required headers", () => {
      expect(CORS_CONFIG.headers).toContain("Authorization");
      expect(CORS_CONFIG.headers).toContain("Content-Type");
      expect(CORS_CONFIG.headers).toContain("X-Request-ID");
    });

    test("should expose rate limit headers", () => {
      expect(CORS_CONFIG.exposeHeaders).toContain("X-RateLimit-Limit");
      expect(CORS_CONFIG.exposeHeaders).toContain("X-RateLimit-Remaining");
      expect(CORS_CONFIG.exposeHeaders).toContain("X-RateLimit-Reset");
      expect(CORS_CONFIG.exposeHeaders).toContain("Retry-After");
    });

    test("should have reasonable max age for preflight cache", () => {
      expect(CORS_CONFIG.maxAge).toBe(86400); // 24 hours
    });
  });
});

describe("CORS Middleware", () => {
  describe("defaultCors", () => {
    test("should allow localhost origin", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000"
      );
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    test("should allow production domain", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "https://han.guru" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://han.guru"
      );
    });

    test("should reject unknown origin", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "https://evil.com" },
      });

      // Request proceeds but without CORS headers
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    test("should handle request without Origin header", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test");
      // No CORS headers needed when no Origin
      expect(res.status).toBe(200);
    });

    test("should expose rate limit headers", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:3000" },
      });

      const exposeHeaders = res.headers.get("Access-Control-Expose-Headers");
      expect(exposeHeaders).toContain("X-RateLimit-Limit");
      expect(exposeHeaders).toContain("X-RateLimit-Remaining");
      expect(exposeHeaders).toContain("X-RateLimit-Reset");
      expect(exposeHeaders).toContain("Retry-After");
    });
  });

  describe("Preflight (OPTIONS) requests", () => {
    test("should handle OPTIONS request efficiently", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.post("/api/data", (c) => c.json({ ok: true }));

      const res = await app.request("/api/data", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });

      expect(res.status).toBe(204); // No Content
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000"
      );
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "Authorization"
      );
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "Content-Type"
      );
      expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    test("should reject preflight from unauthorized origin", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.post("/api/data", (c) => c.json({ ok: true }));

      const res = await app.request("/api/data", {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.com",
          "Access-Control-Request-Method": "POST",
        },
      });

      expect(res.status).toBe(403);
    });

    test("should allow credentials in preflight", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.post("/api/data", (c) => c.json({ ok: true }));

      const res = await app.request("/api/data", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
        },
      });

      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });

  describe("developmentCors", () => {
    test("should allow any origin in development", async () => {
      const app = new Hono();
      app.use("*", developmentCors);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "https://any-domain.com" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://any-domain.com"
      );
    });
  });

  describe("productionCors", () => {
    test("should only allow production domains", async () => {
      const app = new Hono();
      app.use("*", productionCors);
      app.get("/test", (c) => c.json({ ok: true }));

      // Allowed
      const res1 = await app.request("/test", {
        headers: { Origin: "https://han.guru" },
      });
      expect(res1.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://han.guru"
      );

      // Not allowed
      const res2 = await app.request("/test", {
        headers: { Origin: "http://localhost:3000" },
      });
      expect(res2.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    test("should not allow localhost in production mode", async () => {
      const app = new Hono();
      app.use("*", productionCors);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("Custom CORS configuration", () => {
    test("should allow custom origins", async () => {
      const app = new Hono();
      app.use(
        "*",
        cors({
          origins: ["https://custom.example.com"],
          credentials: false,
        })
      );
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "https://custom.example.com" },
      });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://custom.example.com"
      );
      // Credentials should not be set when false
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    });

    test("should allow RegExp patterns", async () => {
      const app = new Hono();
      app.use(
        "*",
        cors({
          origins: [/^https:\/\/.*\.example\.com$/],
        })
      );
      app.get("/test", (c) => c.json({ ok: true }));

      const res1 = await app.request("/test", {
        headers: { Origin: "https://app.example.com" },
      });
      expect(res1.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://app.example.com"
      );

      const res2 = await app.request("/test", {
        headers: { Origin: "https://other.example.com" },
      });
      expect(res2.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://other.example.com"
      );
    });

    test("should allow custom headers", async () => {
      const app = new Hono();
      app.use(
        "*",
        cors({
          headers: ["X-Custom-Header", "Authorization"],
        })
      );
      app.post("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "X-Custom-Header",
        },
      });

      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "X-Custom-Header"
      );
    });

    test("should allow custom expose headers", async () => {
      const app = new Hono();
      app.use(
        "*",
        cors({
          exposeHeaders: ["X-Custom-Response-Header"],
        })
      );
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
        "X-Custom-Response-Header"
      );
    });
  });

  describe("Localhost CLI callback support", () => {
    test("should allow any localhost port for CLI callback", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.get("/callback", (c) => c.json({ token: "abc123" }));

      // Various localhost ports that CLI might use
      const ports = [3000, 8080, 41956, 9999, 49152];

      for (const port of ports) {
        const res = await app.request("/callback", {
          headers: { Origin: `http://localhost:${port}` },
        });

        expect(res.status).toBe(200);
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
          `http://localhost:${port}`
        );
        expect(res.headers.get("Access-Control-Allow-Credentials")).toBe(
          "true"
        );
      }
    });

    test("should allow 127.0.0.1 for CLI callback", async () => {
      const app = new Hono();
      app.use("*", defaultCors);
      app.get("/callback", (c) => c.json({ token: "abc123" }));

      const res = await app.request("/callback", {
        headers: { Origin: "http://127.0.0.1:8080" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://127.0.0.1:8080"
      );
    });
  });
});

describe("Security Considerations", () => {
  test("should not allow wildcard with credentials", async () => {
    // When credentials are enabled, origin must be specific, not *
    const app = new Hono();
    app.use("*", defaultCors);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Origin: "http://localhost:3000" },
    });

    // Should return the specific origin, not *
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000"
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  test("should not leak CORS headers to disallowed origins", async () => {
    const app = new Hono();
    app.use("*", productionCors);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { Origin: "https://attacker.com" },
    });

    // Should not have any CORS headers
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
