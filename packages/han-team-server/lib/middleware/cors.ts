/**
 * CORS Middleware Configuration
 *
 * Configures Cross-Origin Resource Sharing for the Han Team Platform API.
 * Allows requests from:
 * - localhost (any port) for CLI callback
 * - Production domains (han.guru, app.han.guru)
 */

import type { Context, Next, MiddlewareHandler } from "hono";

/**
 * CORS configuration
 */
export interface CorsConfig {
  /** Allowed origins (strings or RegExp patterns) */
  origins: (string | RegExp)[];
  /** Allow credentials (cookies, auth headers) */
  credentials: boolean;
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed request headers */
  headers: string[];
  /** Headers to expose to the client */
  exposeHeaders?: string[];
  /** Max age for preflight cache (seconds) */
  maxAge?: number;
}

/**
 * Default CORS configuration for Han Team Platform
 */
export const CORS_CONFIG: CorsConfig = {
  origins: [
    // CLI callback on any localhost port
    /^http:\/\/localhost:\d+$/,
    // Local development
    /^http:\/\/127\.0\.0\.1:\d+$/,
    // Production domains
    "https://han.guru",
    "https://app.han.guru",
    "https://team.han.guru",
    "https://www.han.guru",
  ],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS", "PUT"],
  headers: [
    "Authorization",
    "Content-Type",
    "X-Request-ID",
    "X-Client-Version",
  ],
  exposeHeaders: [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "Retry-After",
    "X-Request-ID",
  ],
  maxAge: 86400, // 24 hours
};

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string, allowedOrigins: (string | RegExp)[]): boolean {
  for (const allowed of allowedOrigins) {
    if (typeof allowed === "string") {
      if (origin === allowed) {
        return true;
      }
    } else if (allowed instanceof RegExp) {
      if (allowed.test(origin)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * CORS middleware factory
 *
 * Creates a CORS middleware with the specified configuration.
 * Handles both preflight (OPTIONS) requests and actual requests.
 */
export function cors(config: Partial<CorsConfig> = {}): MiddlewareHandler {
  const mergedConfig: CorsConfig = {
    ...CORS_CONFIG,
    ...config,
    origins: config.origins ?? CORS_CONFIG.origins,
    methods: config.methods ?? CORS_CONFIG.methods,
    headers: config.headers ?? CORS_CONFIG.headers,
  };

  const {
    origins,
    credentials,
    methods,
    headers,
    exposeHeaders,
    maxAge,
  } = mergedConfig;

  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin");

    // If no Origin header, not a CORS request
    if (!origin) {
      await next();
      return;
    }

    // Check if origin is allowed
    const allowed = isOriginAllowed(origin, origins);

    if (!allowed) {
      // Origin not allowed - don't add CORS headers
      // For preflight, return 403
      if (c.req.method === "OPTIONS") {
        return c.text("Origin not allowed", 403);
      }
      // For actual requests, proceed without CORS headers
      // Browser will block the response
      await next();
      return;
    }

    // Set CORS headers
    c.header("Access-Control-Allow-Origin", origin);

    if (credentials) {
      c.header("Access-Control-Allow-Credentials", "true");
    }

    if (exposeHeaders && exposeHeaders.length > 0) {
      c.header("Access-Control-Expose-Headers", exposeHeaders.join(", "));
    }

    // Handle preflight (OPTIONS) request
    if (c.req.method === "OPTIONS") {
      // Preflight response headers
      c.header("Access-Control-Allow-Methods", methods.join(", "));
      c.header("Access-Control-Allow-Headers", headers.join(", "));

      if (maxAge) {
        c.header("Access-Control-Max-Age", String(maxAge));
      }

      // Return 204 No Content for successful preflight
      return c.body(null, 204);
    }

    // Continue to actual request handler
    await next();
  };
}

/**
 * Pre-configured CORS middleware with default settings
 */
export const defaultCors = cors();

/**
 * Development CORS - allows all origins (for local development only)
 */
export const developmentCors = cors({
  origins: [/.*/], // Allow all origins
  credentials: true,
});

/**
 * Strict CORS - only production domains
 */
export const productionCors = cors({
  origins: [
    "https://han.guru",
    "https://app.han.guru",
    "https://team.han.guru",
    "https://www.han.guru",
  ],
  credentials: true,
});
