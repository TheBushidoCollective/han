/**
 * Han Team Platform Server
 *
 * Main entry point for the API server.
 *
 * @description The Han Team Server provides:
 * - REST API for session sync and management
 * - GraphQL API for rich querying and analytics
 * - Authentication via JWT tokens
 * - Multi-tenant organization support
 *
 * GraphQL Playground is available at /graphql in non-production environments.
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { getConfig, loadConfig, getMasterEncryptionKey, isMasterKeyConfigured } from "./config/schema.ts";
import { registerHealthRoutes } from "./api/health.ts";
import { registerSessionRoutes } from "./api/sessions/index.ts";
import { registerKeyRotationRoutes } from "./api/keys/rotate.ts";
import { registerAuthRoutes } from "./api/auth/index.ts";
import { onErrorHandler } from "./api/middleware/error-handler.ts";
import { closeConnections, getDbConnection } from "./db/index.ts";
import { getSessionEncryptionService } from "./services/index.ts";
import { initAuthService } from "./auth/index.ts";
import {
  cors,
  defaultCors,
  developmentCors,
  productionCors,
  auth,
  defaultRateLimit,
} from "./middleware/index.ts";
import { standardRateLimit } from "./api/middleware/rate-limiter.ts";
import { createGraphQLHandler } from "./graphql/index.ts";

// Validate configuration on startup
const config = loadConfig();
const env = config.NODE_ENV as "development" | "staging" | "production";
console.log(`Starting Han Team Server (${env})`);

// Initialize authentication service
initAuthService(config.JWT_SECRET);
console.log("Authentication service initialized");

const app = new Hono();

// Global error handler - sanitizes error responses to prevent info leakage
app.onError = onErrorHandler;

// Middleware
app.use("*", logger());

// CORS middleware - use appropriate config based on environment
// SECURITY: Only development gets permissive CORS (localhost allowed)
// Production and staging both use strict production CORS
if (config.NODE_ENV === "development") {
  app.use("*", developmentCors);
} else {
  // Production and staging use strict CORS (no localhost)
  app.use("*", productionCors);
}

// Authentication middleware (parses JWT, sets user context if authenticated)
app.use("*", auth());

// Rate limiting for API routes (not health checks)
app.use("/api/*", defaultRateLimit);

// Health check routes (no auth required)
registerHealthRoutes(app);

// Session API routes
registerSessionRoutes(app);

// Key rotation routes
registerKeyRotationRoutes(app);

// Auth routes (token refresh)
registerAuthRoutes(app);

// GraphQL API endpoint
// In development/staging: serves GraphQL Playground at GET /graphql
// In all environments: handles GraphQL queries at POST /graphql
// Security protections:
// - Authentication middleware extracts user context from JWT
// - Rate limiting prevents abuse (100 req/min per user)
// - Query depth limiting prevents deeply nested queries (in handler)
// - Introspection is disabled in production
app.all("/graphql", auth(), standardRateLimit, async (c) => {
  try {
    const db = await getDbConnection();
    const yoga = createGraphQLHandler({ db, env });
    return yoga.handle(c.req.raw);
  } catch (error) {
    console.error("GraphQL handler error:", error);
    return c.json(
      { errors: [{ message: "Internal server error" }] },
      500
    );
  }
});

// API routes (to be implemented by other units)
app.get("/api/v1", (c) => c.json({ message: "Han Team API v1" }));

// Initialize encryption service
async function initializeEncryption(): Promise<void> {
  const encryptionService = getSessionEncryptionService();
  const masterKey = getMasterEncryptionKey();

  try {
    await encryptionService.initialize(masterKey);

    if (isMasterKeyConfigured()) {
      console.log("Encryption service initialized with master key");
    } else {
      console.log(
        "Encryption service initialized without master key - encryption unavailable until key is provisioned"
      );
    }
  } catch (error) {
    console.error("Failed to initialize encryption service:", error);
    // Don't throw - allow server to start with encryption unavailable
  }
}

// Initialize encryption on startup
initializeEncryption().catch(console.error);

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down...");
  await closeConnections();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start server
const port = config.PORT;
console.log(`Server listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
