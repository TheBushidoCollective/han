/**
 * Middleware Module
 *
 * Exports all middleware for the Han Team Platform API.
 */

// Auth middleware (legacy, simpler JWT-based)
export type { AuthUser, AuthContext } from "./auth.ts";
export {
  getAuthUser,
  getRequiredAuthUser,
  auth,
  requireAuth as requireAuthSimple,
  requireAdmin,
  canAccessTeamKeys,
  canAccessUserKeys,
  getClientInfo,
  // Note: rateLimit and getClientIp from auth.ts are superseded by rate-limit.ts
} from "./auth.ts";

// Rate limiting middleware (Redis-based, distributed)
export {
  rateLimit,
  defaultRateLimit,
  billingRateLimit,
  noRateLimit,
  customRateLimit,
  authenticatedRateLimit,
  RATE_LIMITS,
  getClientIp,
  type RateLimitTier,
  type RateLimitOptions,
} from "./rate-limit.ts";

// CORS middleware
export {
  cors,
  defaultCors,
  developmentCors,
  productionCors,
  CORS_CONFIG,
  type CorsConfig,
} from "./cors.ts";
