/**
 * Health Check Endpoints for Han Team Platform
 *
 * Provides Kubernetes-compatible liveness and readiness probes,
 * plus Prometheus metrics endpoint.
 */

import type { Context } from "hono";
import { getDbConnection, getRedisConnection } from "../db/index.ts";
import { getRetentionService, getScheduler } from "../jobs/index.ts";

// Server start time for uptime calculation
const startTime = Date.now();

// Version from package.json (injected at build time)
const VERSION = process.env.npm_package_version || "1.0.0";

/**
 * Health response for liveness probe
 */
interface HealthResponse {
  status: "ok" | "error";
  version: string;
  uptime: number;
}

/**
 * Readiness response with dependency checks
 */
interface ReadinessResponse {
  status: "ok" | "degraded" | "error";
  version: string;
  checks: {
    database: "ok" | "error";
    redis: "ok" | "error";
    migrations: "ok" | "pending" | "error";
  };
}

/**
 * Liveness probe - /health
 *
 * Simple check that the server is running.
 * Used by Kubernetes to determine if the pod should be restarted.
 */
export async function healthHandler(c: Context): Promise<Response> {
  const response: HealthResponse = {
    status: "ok",
    version: VERSION,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return c.json(response, 200);
}

/**
 * Readiness probe - /ready
 *
 * Checks all dependencies are available.
 * Used by Kubernetes to determine if traffic should be routed to this pod.
 */
export async function readinessHandler(c: Context): Promise<Response> {
  const checks: ReadinessResponse["checks"] = {
    database: "error",
    redis: "error",
    migrations: "error",
  };

  // Check database connection
  try {
    const db = await getDbConnection();
    await db.query("SELECT 1");
    checks.database = "ok";
  } catch (error) {
    console.error("Database health check failed:", error);
  }

  // Check Redis connection
  try {
    const redis = await getRedisConnection();
    await redis.ping();
    checks.redis = "ok";
  } catch (error) {
    console.error("Redis health check failed:", error);
  }

  // Check migration status
  try {
    const db = await getDbConnection();
    const result = await db.query(`
      SELECT COUNT(*) as pending
      FROM _migrations
      WHERE applied_at IS NULL
    `);
    const pending = result.rows[0]?.pending || 0;
    checks.migrations = pending > 0 ? "pending" : "ok";
  } catch (error) {
    // If migrations table doesn't exist, assume pending
    if (String(error).includes("does not exist")) {
      checks.migrations = "pending";
    } else {
      console.error("Migration check failed:", error);
    }
  }

  // Determine overall status
  const allOk = Object.values(checks).every((v) => v === "ok");
  const anyError = Object.values(checks).some((v) => v === "error");

  let status: ReadinessResponse["status"];
  if (allOk) {
    status = "ok";
  } else if (anyError) {
    status = "error";
  } else {
    status = "degraded";
  }

  const response: ReadinessResponse = {
    status,
    version: VERSION,
    checks,
  };

  // Return 503 if not ready
  const httpStatus = status === "error" ? 503 : 200;
  return c.json(response, httpStatus);
}

/**
 * Metrics endpoint - /metrics
 *
 * Prometheus-compatible metrics endpoint.
 */
export async function metricsHandler(c: Context): Promise<Response> {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Get retention job metrics
  let retentionMetrics = "";
  try {
    const retentionService = getRetentionService();
    const jobStatus = retentionService.getJobStatus();
    const schedulerStatus = getScheduler().getStatus();

    retentionMetrics = `
# HELP han_retention_job_running Whether the retention job is currently running
# TYPE han_retention_job_running gauge
han_retention_job_running ${jobStatus.isRunning ? 1 : 0}

# HELP han_retention_scheduler_enabled Whether the retention scheduler is enabled
# TYPE han_retention_scheduler_enabled gauge
han_retention_scheduler_enabled ${schedulerStatus.enabled ? 1 : 0}

# HELP han_retention_last_run_timestamp_seconds Timestamp of last retention job run
# TYPE han_retention_last_run_timestamp_seconds gauge
han_retention_last_run_timestamp_seconds ${jobStatus.lastRun ? Math.floor(jobStatus.lastRun.getTime() / 1000) : 0}

# HELP han_retention_last_deleted_total Sessions deleted in last retention run
# TYPE han_retention_last_deleted_total gauge
han_retention_last_deleted_total ${jobStatus.lastResult?.deletedCount ?? 0}

# HELP han_retention_last_deleted_by_tier Sessions deleted by tier in last retention run
# TYPE han_retention_last_deleted_by_tier gauge
han_retention_last_deleted_by_tier{tier="free"} ${jobStatus.lastResult?.byTier.free ?? 0}
han_retention_last_deleted_by_tier{tier="pro"} ${jobStatus.lastResult?.byTier.pro ?? 0}

# HELP han_retention_last_duration_seconds Duration of last retention job in seconds
# TYPE han_retention_last_duration_seconds gauge
han_retention_last_duration_seconds ${jobStatus.lastResult ? jobStatus.lastResult.durationMs / 1000 : 0}

# HELP han_retention_last_errors_total Errors in last retention run
# TYPE han_retention_last_errors_total gauge
han_retention_last_errors_total ${jobStatus.lastResult?.errors.length ?? 0}

# HELP han_retention_next_run_timestamp_seconds Timestamp of next scheduled retention run
# TYPE han_retention_next_run_timestamp_seconds gauge
han_retention_next_run_timestamp_seconds ${jobStatus.nextScheduledRun ? Math.floor(jobStatus.nextScheduledRun.getTime() / 1000) : 0}
`;
  } catch {
    // Retention service may not be initialized
    retentionMetrics = `
# HELP han_retention_job_running Whether the retention job is currently running
# TYPE han_retention_job_running gauge
han_retention_job_running 0
`;
  }

  // Basic metrics in Prometheus format
  const metrics = `
# HELP han_team_up Whether the Han Team server is up
# TYPE han_team_up gauge
han_team_up 1

# HELP han_team_uptime_seconds How long the server has been running
# TYPE han_team_uptime_seconds counter
han_team_uptime_seconds ${uptime}

# HELP han_team_version Version information
# TYPE han_team_version gauge
han_team_version{version="${VERSION}"} 1

# HELP han_team_info Build and environment information
# TYPE han_team_info gauge
han_team_info{version="${VERSION}",node_env="${process.env.NODE_ENV || "development"}"} 1
${retentionMetrics}`.trim();

  return new Response(metrics, {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}

/**
 * Register health routes with Hono app
 */
export function registerHealthRoutes(app: {
  get: (path: string, handler: (c: Context) => Promise<Response>) => void;
}) {
  app.get("/health", healthHandler);
  app.get("/ready", readinessHandler);
  app.get("/metrics", metricsHandler);
}
