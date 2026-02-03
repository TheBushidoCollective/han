/**
 * GraphQL Endpoint URL Configuration
 *
 * Provides runtime URL resolution for GraphQL endpoints.
 * Uses fixed port 41957 for the coordinator.
 */

import { getCoordinatorPort } from './port.ts';

/**
 * Build-time injected URLs (replaced by Bun.build define)
 * These constants are replaced at build time with actual values
 */
declare const __GRAPHQL_URL__: string | undefined;
declare const __GRAPHQL_WS_URL__: string | undefined;

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
 * 2. Hosted mode: coordinator.local.han.guru:41957
 * 3. Local mode: localhost via HTTP
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

  const port = getCoordinatorPort();

  // Hosted dashboard mode - connect to coordinator via HTTPS
  if (isHostedMode()) {
    return {
      http: `https://coordinator.local.han.guru:${port}/graphql`,
      ws: `wss://coordinator.local.han.guru:${port}/graphql`,
    };
  }

  // Local development mode - connect via HTTP
  return {
    http: `http://127.0.0.1:${port}/graphql`,
    ws: `ws://127.0.0.1:${port}/graphql`,
  };
}
