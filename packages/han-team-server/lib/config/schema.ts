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

  // Security
  TRUST_PROXY: z
    .string()
    .transform((val) => val === "true")
    .default("false")
    .describe("Trust X-Forwarded-For headers (enable behind reverse proxy)"),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default("han-team"),

  // Encryption
  MASTER_ENCRYPTION_KEY: z
    .string()
    .min(32, "MASTER_ENCRYPTION_KEY must be at least 32 characters (base64 encoded 32-byte key)")
    .optional()
    .describe(
      "Master key for bootstrapping team encryption (optional, derive if not set). " +
      "Base64-encoded 32-byte key. If not provided, encryption will be unavailable " +
      "until a key is provisioned."
    ),

  // Stripe billing
  STRIPE_API_KEY: z
    .string()
    .optional()
    .describe("Stripe secret API key for billing operations"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .describe("Stripe webhook signing secret for signature verification"),
  STRIPE_PRO_MONTHLY_PRICE_ID: z
    .string()
    .optional()
    .describe("Stripe Price ID for monthly PRO subscription"),
  STRIPE_PRO_YEARLY_PRICE_ID: z
    .string()
    .optional()
    .describe("Stripe Price ID for yearly PRO subscription"),

  // Application URL
  APP_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:3000")
    .describe("Base URL of the application for Stripe redirects"),
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

/**
 * Check if master encryption key is configured
 */
export function isMasterKeyConfigured(): boolean {
  const config = getConfig();
  return Boolean(config.MASTER_ENCRYPTION_KEY);
}

/**
 * Get the master encryption key (if configured)
 */
export function getMasterEncryptionKey(): string | undefined {
  const config = getConfig();
  return config.MASTER_ENCRYPTION_KEY;
}

/**
 * Check if Stripe billing is configured
 */
export function isStripeBillingEnabled(): boolean {
  const config = getConfig();
  return Boolean(
    config.STRIPE_API_KEY &&
    config.STRIPE_PRO_MONTHLY_PRICE_ID &&
    config.STRIPE_PRO_YEARLY_PRICE_ID
  );
}

/**
 * Get Stripe configuration (throws if not configured)
 */
export function getStripeConfig(): {
  apiKey: string;
  webhookSecret: string;
  proMonthlyPriceId: string;
  proYearlyPriceId: string;
  appBaseUrl: string;
} {
  const config = getConfig();
  if (!config.STRIPE_API_KEY) {
    throw new Error("STRIPE_API_KEY is not configured");
  }
  if (!config.STRIPE_PRO_MONTHLY_PRICE_ID) {
    throw new Error("STRIPE_PRO_MONTHLY_PRICE_ID is not configured");
  }
  if (!config.STRIPE_PRO_YEARLY_PRICE_ID) {
    throw new Error("STRIPE_PRO_YEARLY_PRICE_ID is not configured");
  }
  return {
    apiKey: config.STRIPE_API_KEY,
    webhookSecret: config.STRIPE_WEBHOOK_SECRET ?? "",
    proMonthlyPriceId: config.STRIPE_PRO_MONTHLY_PRICE_ID,
    proYearlyPriceId: config.STRIPE_PRO_YEARLY_PRICE_ID,
    appBaseUrl: config.APP_BASE_URL,
  };
}
