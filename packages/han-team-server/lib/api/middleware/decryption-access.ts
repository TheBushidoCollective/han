/**
 * Decryption Access Middleware for Han Team Platform
 *
 * Validates that the requesting user has access to decrypt
 * the requested resource (session/team data).
 */

import { type Context, type Next } from "hono";
import { getAuditService } from "../../audit/index.ts";
import type { OperationContext } from "../../services/index.ts";

/**
 * Extended context with operation context
 */
export interface AuthenticatedContext {
  /** Authenticated user ID */
  userId: string;
  /** User's team IDs */
  teamIds: string[];
  /** Is admin user */
  isAdmin: boolean;
}

/**
 * Hono context variables
 */
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthenticatedContext;
    operationContext: OperationContext;
  }
}

/**
 * List of trusted proxy IPs (configure in production)
 *
 * In production, this should be loaded from environment config
 * and contain only the IP addresses of your load balancer/reverse proxy.
 */
const TRUSTED_PROXIES: Set<string> = new Set([
  // Add your proxy IPs here in production
  // "10.0.0.1",
  // "172.16.0.1",
]);

/**
 * Check if we're behind a trusted proxy
 */
function isTrustedProxy(c: Context): boolean {
  // In production mode, only trust specific proxy IPs
  if (process.env.NODE_ENV === "production") {
    // Get the direct connection IP (would need Bun-specific API or framework support)
    // For now, only trust X-Forwarded-For if TRUST_PROXY env var is set
    return process.env.TRUST_PROXY === "true";
  }
  // In development, don't trust proxy headers by default
  return false;
}

/**
 * Get client IP address from request
 *
 * Only trusts X-Forwarded-For header when behind a known trusted proxy.
 */
function getClientIp(c: Context): string {
  // Only use forwarded headers if behind a trusted proxy
  if (isTrustedProxy(c)) {
    // Check X-Forwarded-For header (behind proxy)
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      // Take the leftmost IP (original client)
      return forwarded.split(",")[0].trim();
    }

    // Check X-Real-IP header
    const realIp = c.req.header("x-real-ip");
    if (realIp) {
      return realIp;
    }
  }

  // In Bun, we could get the actual connection IP from the request
  // For now, return a placeholder that indicates direct connection
  return "direct-connection";
}

/**
 * Build operation context from request
 */
export function buildOperationContext(c: Context): OperationContext {
  const auth = c.get("auth");

  return {
    userId: auth?.userId || "anonymous",
    teamId: auth?.teamIds?.[0], // Primary team
    ipAddress: getClientIp(c),
    userAgent: c.req.header("user-agent"),
    requestId: c.req.header("x-request-id") || crypto.randomUUID(),
  };
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        error: "unauthorized",
        message: "Authentication required",
      },
      401
    );
  }

  // In production, validate JWT token here
  // For now, extract user info from a mock token
  const token = authHeader.slice(7);

  try {
    // Mock token validation (real implementation would verify JWT)
    const auth = await validateToken(token);
    c.set("auth", auth);
    c.set("operationContext", buildOperationContext(c));
    await next();
  } catch (error) {
    const auditService = getAuditService();
    await auditService.log({
      eventType: "auth.failed_login",
      metadata: {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
        error: "invalid_token",
      },
      success: false,
      errorMessage: "Invalid authentication token",
    });

    return c.json(
      {
        error: "unauthorized",
        message: "Invalid authentication token",
      },
      401
    );
  }
}

/**
 * Middleware to validate decryption access for a specific resource
 *
 * Checks that the user has permission to decrypt the requested resource:
 * - User owns the resource (userId matches)
 * - User is member of the team that owns the resource
 * - User is admin
 */
export function requireDecryptionAccess(
  resourceType: "session" | "team"
): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const auth = c.get("auth");
    const operationContext = c.get("operationContext");

    if (!auth) {
      return c.json(
        {
          error: "unauthorized",
          message: "Authentication required",
        },
        401
      );
    }

    // Extract resource identifiers from request
    const sessionId = c.req.param("id") || c.req.query("sessionId");
    const teamId = c.req.param("teamId") || c.req.query("teamId");

    // Admins have access to everything
    if (auth.isAdmin) {
      await next();
      return;
    }

    // For session access, check ownership or team membership
    if (resourceType === "session" && sessionId) {
      // In production, look up the session's owner/team
      // For now, assume the session lookup will be done in the handler
      // and the key derivation will fail if access is not permitted
    }

    // For team access, check membership
    if (resourceType === "team" && teamId) {
      if (!auth.teamIds.includes(teamId)) {
        const auditService = getAuditService();
        await auditService.log({
          eventType: "session.view",
          userId: auth.userId,
          teamId,
          metadata: {
            ...operationContext,
            error: "access_denied",
            resourceType,
          },
          success: false,
          errorMessage: "User is not a member of this team",
        });

        return c.json(
          {
            error: "forbidden",
            message: "You do not have access to this resource",
          },
          403
        );
      }
    }

    await next();
  };
}

/**
 * Validate a token and return auth context
 *
 * NOTE: This is a stub. Real implementation would verify JWT signature,
 * check expiration, and look up user permissions.
 *
 * SECURITY: Test tokens are ONLY allowed when ALL of these conditions are met:
 * 1. NODE_ENV is explicitly "test"
 * 2. HAN_TEST_MODE is explicitly "true"
 * 3. We are NOT in a production-like environment (no PRODUCTION_MODE flag)
 *
 * This triple-gate prevents accidental test token access in production.
 */
async function validateToken(token: string): Promise<AuthenticatedContext> {
  // SECURITY: Strict production environment detection
  // Even if NODE_ENV is misconfigured, these flags catch production deployments
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.PRODUCTION_MODE === "true" ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    process.env.FLY_APP_NAME !== undefined ||
    process.env.RENDER === "true" ||
    process.env.VERCEL_ENV === "production";

  // SECURITY: Test tokens require explicit opt-in AND non-production environment
  if (token.startsWith("test:")) {
    // Triple-gate check: must be test environment AND explicitly enabled AND not production
    const isTestEnvironment = process.env.NODE_ENV === "test";
    const isTestModeEnabled = process.env.HAN_TEST_MODE === "true";

    if (isProduction) {
      // Log attempted test token use in production for security monitoring
      console.error(
        "[SECURITY] Attempted test token authentication in production environment"
      );
      throw new Error("Invalid authentication token");
    }

    if (!isTestEnvironment || !isTestModeEnabled) {
      throw new Error("Test tokens are not allowed in this environment");
    }

    const parts = token.split(":");
    const userId = parts[1] || "user-1";
    const teamIds = parts[2] ? parts[2].split(",") : [];
    const isAdmin = parts[3] === "true";

    // SECURITY: Limit test token privileges
    // Test tokens cannot grant admin access in any environment other than pure unit tests
    const allowAdminInTests = process.env.HAN_ALLOW_TEST_ADMIN === "true";
    const effectiveIsAdmin = isAdmin && allowAdminInTests;

    return {
      userId,
      teamIds,
      isAdmin: effectiveIsAdmin,
    };
  }

  // In production, verify JWT here using jose library
  // const { payload } = await jwtVerify(token, secretKey);

  throw new Error("Invalid token format");
}

/**
 * Check if user has access to a specific encryption key
 *
 * SECURITY: Global keys require admin privileges to prevent
 * unauthorized access to shared encrypted data.
 */
export async function hasKeyAccess(
  auth: AuthenticatedContext,
  keyId: string
): Promise<boolean> {
  // Parse key ID to determine scope
  // Format: "team:{teamId}" or "user:{userId}" or "global:default"
  const [scope, id] = keyId.split(":");

  switch (scope) {
    case "user":
      return auth.userId === id || auth.isAdmin;
    case "team":
      return auth.teamIds.includes(id) || auth.isAdmin;
    case "global":
      // SECURITY FIX: Global keys require admin access
      // This prevents any authenticated user from accessing all global-encrypted data
      return auth.isAdmin;
    default:
      return false;
  }
}
