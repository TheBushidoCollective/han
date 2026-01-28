/**
 * GraphQL Endpoint URL Configuration
 *
 * Provides runtime URL resolution for GraphQL endpoints.
 * Supports both local development and hosted dashboard modes.
 * Supports multiple coordinator environments with auto-discovery.
 */

import { quickDiscoverCoordinator } from './discovery.ts';
import {
  addEnvironment,
  getActiveEnvironment,
  setActiveEnvironmentId,
} from './environments.ts';
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
 * Cache for discovered coordinator to avoid repeated discovery
 */
let discoveredCoordinator: GraphQLEndpoints | null = null;
let discoveryInProgress = false;

/**
 * Get GraphQL endpoints based on environment
 *
 * Priority order:
 * 1. Build-time injected URLs (for custom deployments)
 * 2. Active environment from localStorage (user-selected coordinator)
 * 3. Auto-discovered coordinator (hosted mode only, cached after first discovery)
 * 4. Hosted mode fallback: coordinator.local.han.guru:41957
 * 5. Local mode: localhost via HTTP
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

  // Check for active environment in localStorage
  const activeEnv = getActiveEnvironment();
  if (activeEnv) {
    // Validate URLs have protocol to prevent relative path issues
    const httpUrl = activeEnv.coordinatorUrl;
    const wsUrl = activeEnv.wsUrl;

    // Only use stored env if URLs are valid absolute URLs
    if (
      httpUrl &&
      wsUrl &&
      (httpUrl.startsWith('https://') || httpUrl.startsWith('http://')) &&
      (wsUrl.startsWith('wss://') || wsUrl.startsWith('ws://'))
    ) {
      return {
        http: `${httpUrl}/graphql`,
        ws: `${wsUrl}/graphql`,
      };
    }
    // Invalid stored environment - fall through to discovery/defaults
    console.warn('Invalid stored environment URLs, using defaults:', {
      coordinatorUrl: httpUrl,
      wsUrl,
    });
  }

  // Use cached discovery result if available
  if (discoveredCoordinator) {
    return discoveredCoordinator;
  }

  // Trigger auto-discovery in background (hosted mode only)
  if (isHostedMode() && !discoveryInProgress) {
    discoveryInProgress = true;
    quickDiscoverCoordinator()
      .then((env) => {
        if (env) {
          // Save discovered environment
          const savedEnv = addEnvironment({
            name: env.name,
            coordinatorUrl: env.coordinatorUrl,
            wsUrl: env.wsUrl,
            lastConnected: env.lastConnected,
          });
          setActiveEnvironmentId(savedEnv.id);

          // Cache the result
          discoveredCoordinator = {
            http: `${env.coordinatorUrl}/graphql`,
            ws: `${env.wsUrl}/graphql`,
          };

          // Reload to use the discovered environment
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }
      })
      .finally(() => {
        discoveryInProgress = false;
      });
  }

  // Hosted dashboard mode fallback - connect to coordinator port from URL
  if (isHostedMode()) {
    const port = getCoordinatorPort();
    return {
      http: `https://coordinator.local.han.guru:${port}/graphql`,
      ws: `wss://coordinator.local.han.guru:${port}/graphql`,
    };
  }

  // Local development mode - connect via HTTP
  const port = getCoordinatorPort();
  return {
    http: `http://127.0.0.1:${port}/graphql`,
    ws: `ws://127.0.0.1:${port}/graphql`,
  };
}
