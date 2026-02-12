/**
 * Coordinator Health Hook
 *
 * Polls the coordinator's GraphQL endpoint to determine connectivity.
 * Returns connection status for use by ConnectionGate.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getGraphQLEndpoints } from "../config/urls.ts";

interface CoordinatorHealthState {
	isConnected: boolean;
	isChecking: boolean;
}

const POLL_INTERVAL_DISCONNECTED = 3000;
const POLL_INTERVAL_CONNECTED = 15000;

export function useCoordinatorHealth(): CoordinatorHealthState {
	const [isConnected, setIsConnected] = useState(false);
	const [isChecking, setIsChecking] = useState(true);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const checkHealth = useCallback(async () => {
		// Cancel any in-flight request
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setIsChecking(true);

		try {
			const endpoints = getGraphQLEndpoints();
			const response = await fetch(endpoints.http, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "{ __typename }" }),
				signal: controller.signal,
			});

			if (!controller.signal.aborted) {
				const connected = response.ok;
				setIsConnected(connected);
				setIsChecking(false);
				return connected;
			}
		} catch {
			if (!controller.signal.aborted) {
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
