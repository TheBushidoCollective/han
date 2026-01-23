/**
 * GraphQL Endpoint URL Configuration
 *
 * Provides runtime URL resolution for GraphQL endpoints.
 * Supports both local development and hosted dashboard modes.
 */

/**
 * Build-time injected URLs (replaced by Bun.build define)
 * These constants are replaced at build time with actual values
 */
declare const __GRAPHQL_URL__: string | undefined;
declare const __GRAPHQL_WS_URL__: string | undefined;

/**
 * Default coordinator port for local development
 * Matches DEFAULT_COORDINATOR_PORT in packages/han
 */
const COORDINATOR_PORT = 41957;

export interface GraphQLEndpoints {
  http: string;
  ws: string;
}

/**
 * Detect if we're running in hosted dashboard mode
 * by checking the current hostname
 */
function isHostedMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.hostname === 'dashboard.local.han.guru';
}

/**
 * Get GraphQL endpoints based on environment
 *
 * Priority order:
 * 1. Build-time injected URLs (for custom deployments)
 * 2. Hosted mode: connects to coordinator.local.han.guru via HTTPS
 * 3. Local mode: connects to localhost via HTTP
 */
export function getGraphQLEndpoints(): GraphQLEndpoints {
  // Use build-time injected URLs if available
  if (
    typeof __GRAPHQL_URL__ !== 'undefined' &&
    typeof __GRAPHQL_WS_URL__ !== 'undefined'
  ) {
    return {
      http: __GRAPHQL_URL__,
      ws: __GRAPHQL_WS_URL__,
    };
  }

  // Hosted dashboard mode - connect to local coordinator via HTTPS
  if (isHostedMode()) {
    return {
      http: 'https://coordinator.local.han.guru:41957/graphql',
      ws: 'wss://coordinator.local.han.guru:41957/graphql',
    };
  }

  // Local development mode - connect via HTTP
  return {
    http: `http://127.0.0.1:${COORDINATOR_PORT}/graphql`,
    ws: `ws://127.0.0.1:${COORDINATOR_PORT}/graphql`,
  };
}
