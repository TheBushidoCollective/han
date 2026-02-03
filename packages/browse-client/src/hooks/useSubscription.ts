/**
 * useSubscription Hook
 *
 * React hook for GraphQL subscriptions via WebSocket.
 */

import { type Client, createClient } from "graphql-ws";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGraphQLEndpoints } from "../config/urls.ts";

/**
 * Singleton WebSocket client for subscriptions
 */
let wsClient: Client | null = null;

function getWsClient(): Client {
	if (typeof window === "undefined") {
		throw new Error("WebSocket client can only be created on the client side");
	}

	if (!wsClient) {
		const endpoints = getGraphQLEndpoints();
		wsClient = createClient({
			url: endpoints.ws,
			retryAttempts: 5,
			shouldRetry: () => true,
		});
	}
	return wsClient;
}

/**
 * Subscribe to a GraphQL subscription
 */
function subscribe<T>(
	query: string,
	onData: (data: T) => void,
	onError: (error: Error) => void,
): () => void {
	const client = getWsClient();

	const unsubscribe = client.subscribe(
		{ query },
		{
			next: (result) => {
				if (result.data) {
					onData(result.data as T);
				}
			},
			error: (err: unknown) => {
				onError(err instanceof Error ? err : new Error(String(err)));
			},
			complete: () => {},
		},
	);

	return unsubscribe;
}

interface UseSubscriptionOptions<T> {
	/** The GraphQL subscription query */
	subscription: string;
	/** Callback when data is received */
	onData?: (data: T) => void;
	/** Whether the subscription is enabled */
	enabled?: boolean;
}

interface UseSubscriptionResult<T> {
	/** Latest data received from subscription */
	data: T | null;
	/** Error if subscription failed */
	error: Error | null;
	/** Whether the subscription is connected */
	isConnected: boolean;
}

/**
 * Hook for subscribing to GraphQL subscriptions
 */
export function useSubscription<T = unknown>({
	subscription,
	onData,
	enabled = true,
}: UseSubscriptionOptions<T>): UseSubscriptionResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<Error | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const onDataRef = useRef(onData);

	// Keep onData ref updated
	useEffect(() => {
		onDataRef.current = onData;
	}, [onData]);

	useEffect(() => {
		if (!enabled) {
			setIsConnected(false);
			return;
		}

		setIsConnected(true);
		setError(null);

		const unsubscribe = subscribe<T>(
			subscription,
			(newData: T) => {
				setData(newData);
				onDataRef.current?.(newData);
			},
			(err: Error) => {
				setError(err);
				setIsConnected(false);
			},
		);

		return () => {
			unsubscribe();
			setIsConnected(false);
		};
	}, [subscription, enabled]);

	return { data, error, isConnected };
}

/**
 * Hook for listening to memory update events
 */
export function useMemoryUpdates(
	onUpdate?: (event: MemoryUpdateEvent) => void,
): UseSubscriptionResult<{ memoryUpdated: MemoryUpdateEvent }> {
	const handleData = useCallback(
		(data: { memoryUpdated: MemoryUpdateEvent }) => {
			onUpdate?.(data.memoryUpdated);
		},
		[onUpdate],
	);

	return useSubscription<{ memoryUpdated: MemoryUpdateEvent }>({
		subscription: `
			subscription MemoryUpdatedSubscription {
				memoryUpdated {
					type
					action
					path
					timestamp
				}
			}
		`,
		onData: handleData,
	});
}

/**
 * Memory update event type
 */
export interface MemoryUpdateEvent {
	type: "SESSION" | "SUMMARY" | "RULE" | "OBSERVATION" | "RELOAD";
	action: "CREATED" | "UPDATED" | "DELETED";
	path: string;
	timestamp: string;
}
