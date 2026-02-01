/**
 * Middleware module exports
 */
export {
  requireAuth,
  requireDecryptionAccess,
  buildOperationContext,
  hasKeyAccess,
  type AuthenticatedContext,
} from "./decryption-access.ts";

export {
  errorHandler,
  onErrorHandler,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  type ErrorResponse,
} from "./error-handler.ts";

export {
  rateLimit,
  standardRateLimit,
  strictRateLimit,
  exportRateLimit,
  syncRateLimit,
  authRateLimit,
  resetRateLimiter,
  getClientIp,
} from "./rate-limiter.ts";
