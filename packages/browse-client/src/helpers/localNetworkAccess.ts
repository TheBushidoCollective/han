/**
 * Local Network Access detection.
 *
 * The coordinator listens on loopback. Chrome 151 gates a page served from a
 * public origin from reaching a loopback address behind the
 * `local-network-access` permission, and the page cannot obtain that permission
 * itself: a fetch carrying `targetAddressSpace: "loopback"` still fails, with or
 * without a user gesture, and the permission stays at "prompt".
 *
 * So a public-origin page never connects, however healthy the coordinator is.
 * Telling the visitor to start or install the coordinator in that situation is
 * wrong, and it is what the connection overlay used to do forever.
 */

import { getGraphQLEndpoints } from "../config/urls.ts";

/**
 * Hostnames that resolve to this machine.
 *
 * `coordinator.local.han.guru` is a public DNS name pointing at 127.0.0.1, so it
 * belongs here: it is a loopback target even though it does not look like one.
 */
const LOOPBACK_HOSTNAMES = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"[::1]",
	"coordinator.local.han.guru",
]);

function isLoopbackHostname(hostname: string): boolean {
	if (LOOPBACK_HOSTNAMES.has(hostname)) {
		return true;
	}
	// The whole 127.0.0.0/8 block is loopback, not just 127.0.0.1.
	return /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

/** Whether the page itself is served from this machine. */
export function isLoopbackOrigin(hostname?: string): boolean {
	const host =
		hostname ?? (typeof window === "undefined" ? "" : window.location.hostname);
	return host !== "" && isLoopbackHostname(host);
}

/** Whether the configured coordinator is a loopback target. */
export function coordinatorIsLoopback(endpoint?: string): boolean {
	const url = endpoint ?? getGraphQLEndpoints().http;
	try {
		return isLoopbackHostname(new URL(url).hostname);
	} catch {
		return false;
	}
}

/**
 * Whether this page is blocked from reaching the coordinator by the browser
 * rather than by the coordinator being absent.
 *
 * True only when the page is public *and* the coordinator is loopback. A page
 * already on loopback is unrestricted, and a coordinator on a routable address
 * is not gated, so in both of those cases a failure really does mean the
 * coordinator is unreachable and the normal advice applies.
 */
export function isBlockedByLocalNetworkAccess(options?: {
	pageHostname?: string;
	coordinatorEndpoint?: string;
}): boolean {
	return (
		!isLoopbackOrigin(options?.pageHostname) &&
		coordinatorIsLoopback(options?.coordinatorEndpoint)
	);
}
