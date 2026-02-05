/**
 * GraphQL Endpoint URL Configuration
 *
 * Provides runtime URL resolution for GraphQL endpoints.
 * Supports multiple configuration methods for flexibility.
 */

import { getCoordinatorPort } from "./port.ts";

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
 * Get coordinator URL from URL query parameters
 * Allows override via ?coordinatorUrl=https://example.com
 */
function getCoordinatorUrlOverride(): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	const params = new URLSearchParams(window.location.search);
	return params.get("coordinatorUrl");
}

/**
 * Get GraphQL endpoints based on environment
 *
 * Priority order:
 * 1. URL query parameter: ?coordinatorUrl=https://coordinator.example.com
 * 2. Build-time injected URLs (for custom deployments)
 * 3. Default: coordinator.local.han.guru (HTTPS)
 */
export function getGraphQLEndpoints(): GraphQLEndpoints {
	// 1. Check for URL override (highest priority)
	const urlOverride = getCoordinatorUrlOverride();
	if (urlOverride) {
		const isSecure = urlOverride.startsWith("https://");
		const wsProtocol = isSecure ? "wss" : "ws";
		const wsUrl = urlOverride.replace(/^https?:\/\//, `${wsProtocol}://`);
		return {
			http: urlOverride.endsWith("/graphql")
				? urlOverride
				: `${urlOverride}/graphql`,
			ws: wsUrl.endsWith("/graphql") ? wsUrl : `${wsUrl}/graphql`,
		};
	}

	// 2. Use build-time injected URLs if available
	if (
		typeof __GRAPHQL_URL__ !== "undefined" &&
		typeof __GRAPHQL_WS_URL__ !== "undefined"
	) {
		return {
			http: __GRAPHQL_URL__,
			ws: __GRAPHQL_WS_URL__,
		};
	}

	const port = getCoordinatorPort();

	// 3. Always use HTTPS coordinator URL
	// This works for both local and hosted because coordinator.local.han.guru
	// resolves to localhost with valid HTTPS via the cert-server
	return {
		http: `https://coordinator.local.han.guru:${port}/graphql`,
		ws: `wss://coordinator.local.han.guru:${port}/graphql`,
	};
}
