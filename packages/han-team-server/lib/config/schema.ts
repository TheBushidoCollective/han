/**
 * Configuration Schema for Han Team Platform
 *
 * Validates environment variables on startup and provides
 * type-safe configuration access throughout the application.
 */

import { z } from "zod";

/**
 * Configuration schema with validation rules
 */
export const ConfigSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
      "DATABASE_URL must be a valid PostgreSQL connection string"
    ),

  // Redis
  REDIS_URL: z
    .string()
    .default("redis://localhost:6379")
    .refine(
      (url) => url.startsWith("redis://") || url.startsWith("rediss://"),
      "REDIS_URL must be a valid Redis connection string"
    ),

  // Authentication secrets
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .describe("Secret for signing JWT tokens"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .describe("Secret for encrypting session cookies"),

  // GitHub OAuth (optional)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Server configuration
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),

  // Feature flags
  AUTO_MIGRATE: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // Data retention
  FREE_RETENTION_DAYS: z.coerce.number().default(30),
  PRO_RETENTION_DAYS: z.coerce.number().default(365),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default("han-team"),
});

/**
 * Parsed configuration type
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Validate and parse configuration from environment variables
 */
export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      return `  - ${issue.path.join(".")}: ${issue.message}`;
    });

    console.error("Configuration validation failed:");
    console.error(errors.join("\n"));
    console.error("");
    console.error("Required environment variables:");
    console.error("  - DATABASE_URL: PostgreSQL connection string");
    console.error("  - JWT_SECRET: Secret for JWT signing (min 32 chars)");
    console.error("  - SESSION_SECRET: Secret for sessions (min 32 chars)");

    throw new Error(`Invalid configuration: ${errors.join("; ")}`);
  }

  return result.data;
}

/**
 * Singleton configuration instance
 */
let _config: Config | null = null;

/**
 * Get the application configuration
 * Loads and validates on first access
 */
export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Check if GitHub OAuth is configured
 */
export function isGitHubOAuthEnabled(): boolean {
  const config = getConfig();
  return Boolean(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET);
}

/**
 * Check if OpenTelemetry is configured
 */
export function isOtelEnabled(): boolean {
  const config = getConfig();
  return Boolean(config.OTEL_EXPORTER_OTLP_ENDPOINT);
}
