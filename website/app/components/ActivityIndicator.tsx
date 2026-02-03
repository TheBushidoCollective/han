"use client";

import { useEffect, useState } from "react";

const COORDINATOR_HTTP_URL = "https://coordinator.local.han.guru:41957/graphql";
const COORDINATOR_WS_URL = "wss://coordinator.local.han.guru:41957/graphql";

// 5 minutes in milliseconds
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

const ANY_MESSAGE_SUBSCRIPTION = `
  subscription AnyMessage {
    sessionMessageAdded(sessionId: "*") {
      sessionId
      messageIndex
    }
  }
`;

// Query to check for recent activity (sessions updated in last 5 minutes)
const RECENT_ACTIVITY_QUERY = `
  query RecentActivity {
    sessions(first: 1) {
      edges {
        node {
          id
          updatedAt
        }
      }
    }
  }
`;

export function ActivityIndicator() {
	const [connected, setConnected] = useState(false);
	const [active, setActive] = useState(false);

	useEffect(() => {
		let ws: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

		function markActive() {
			setActive(true);
			// Reset inactivity timer
			if (inactivityTimer) clearTimeout(inactivityTimer);
			inactivityTimer = setTimeout(() => setActive(false), INACTIVITY_TIMEOUT);
		}

		function markInactive() {
			setActive(false);
			if (inactivityTimer) clearTimeout(inactivityTimer);
		}

		// Check for recent activity on initial connection
		async function checkRecentActivity() {
			try {
				const response = await fetch(COORDINATOR_HTTP_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query: RECENT_ACTIVITY_QUERY }),
				});
				const data = await response.json();
				const sessions = data?.data?.sessions?.edges || [];
				if (sessions.length > 0) {
					const lastUpdated = new Date(sessions[0].node.updatedAt).getTime();
					const now = Date.now();
					if (now - lastUpdated < INACTIVITY_TIMEOUT) {
						// Recent activity found - mark as active
						markActive();
					}
				}
			} catch {
				// Ignore fetch errors - will use subscription data
			}
		}

		function connect() {
			ws = new WebSocket(COORDINATOR_WS_URL, "graphql-transport-ws");

			ws.onopen = () => {
				ws?.send(JSON.stringify({ type: "connection_init" }));
			};

			ws.onmessage = (e) => {
				const msg = JSON.parse(e.data);
				if (msg.type === "connection_ack") {
					setConnected(true);
					// Check for recent activity
					checkRecentActivity();
					// Subscribe to all messages across sessions
					ws?.send(
						JSON.stringify({
							id: "1",
							type: "subscribe",
							payload: { query: ANY_MESSAGE_SUBSCRIPTION },
						}),
					);
				} else if (msg.type === "next") {
					// New activity - mark active
					markActive();
				}
			};

			ws.onclose = () => {
				setConnected(false);
				markInactive();
				reconnectTimer = setTimeout(connect, 5000);
			};

			ws.onerror = () => ws?.close();
		}

		connect();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (inactivityTimer) clearTimeout(inactivityTimer);
			if (ws) {
				ws.onclose = null;
				ws.close();
			}
		};
	}, []);

	if (!connected) return null;

	return (
		<a
			href="https://dashboard.local.han.guru/"
			target="_blank"
			rel="noopener noreferrer"
			title="Open Han Dashboard"
		>
			<span className="relative flex h-3 w-3">
				{active ? (
					<>
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
						<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
					</>
				) : (
					<span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400" />
				)}
			</span>
		</a>
	);
}
