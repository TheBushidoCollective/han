/**
 * Han Team Platform Server
 *
 * Main entry point for the API server.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getConfig, loadConfig } from "./config/schema.ts";
import { registerHealthRoutes } from "./api/health.ts";
import { closeConnections } from "./db/index.ts";

// Validate configuration on startup
const config = loadConfig();
console.log(`Starting Han Team Server (${process.env.NODE_ENV || "development"})`);

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: config.NODE_ENV === "production" ? "https://team.han.guru" : "*",
    credentials: true,
  })
);

// Health check routes (no auth required)
registerHealthRoutes(app);

// API routes (to be implemented by other units)
app.get("/api/v1", (c) => c.json({ message: "Han Team API v1" }));

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
