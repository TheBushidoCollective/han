/**
 * Coordinator Health Hook
 *
 * Polls the coordinator's /health endpoint to determine connectivity.
 * Uses a lightweight GET request instead of a GraphQL POST for speed.
 * Returns connection status for use by ConnectionGate.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getCoordinatorPort } from "../config/port.ts";

interface CoordinatorHealthState {
	isConnected: boolean;
	isChecking: boolean;
}

const POLL_INTERVAL_DISCONNECTED = 2000;
const POLL_INTERVAL_CONNECTED = 15000;
/** Timeout for health check fetch — prevents hanging on TLS negotiation */
const HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * Module-level cache to prevent overlay flash on page navigation.
 * Once connected, subsequent hook mounts start with isConnected=true
 * so the ConnectionGate skips the "disconnected" phase entirely.
 */
let cachedIsConnected = false;

/**
 * Build the health endpoint URL.
 * Uses the same coordinator host/port as GraphQL but hits GET /health
 * which is much cheaper (no GraphQL parsing, no DB access).
 */
function getHealthUrl(): string {
	const port = getCoordinatorPort();
	return `https://coordinator.local.han.guru:${port}/health`;
}

export function useCoordinatorHealth(): CoordinatorHealthState {
	const [isConnected, setIsConnected] = useState(cachedIsConnected);
	const [isChecking, setIsChecking] = useState(true);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const checkHealth = useCallback(async () => {
		// Cancel any in-flight request
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		// Auto-abort after timeout to prevent hanging on TLS
		const timeoutId = setTimeout(
			() => controller.abort(),
			HEALTH_CHECK_TIMEOUT_MS,
		);

		setIsChecking(true);

		try {
			const response = await fetch(getHealthUrl(), {
				method: "GET",
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!controller.signal.aborted) {
				const connected = response.ok;
				cachedIsConnected = connected;
				setIsConnected(connected);
				setIsChecking(false);
				return connected;
			}
		} catch {
			clearTimeout(timeoutId);
			if (!controller.signal.aborted) {
				cachedIsConnected = false;
				setIsConnected(false);
				setIsChecking(false);
			}
		}
		return false;
	}, []);

	useEffect(() => {
		let mounted = true;

		const poll = async () => {
			if (!mounted) return;
			const connected = await checkHealth();
			if (!mounted) return;

			const interval = connected
				? POLL_INTERVAL_CONNECTED
				: POLL_INTERVAL_DISCONNECTED;
			timerRef.current = setTimeout(poll, interval);
		};

		poll();

		return () => {
			mounted = false;
			abortRef.current?.abort();
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [checkHealth]);

	return { isConnected, isChecking };
}
