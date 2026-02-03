"use client";

import { useEffect, useState } from "react";

type ConnectionState = "checking" | "connected" | "disconnected";

interface ActivityStatus {
	state: ConnectionState;
	activeSessions: number;
}

const COORDINATOR_URL = "https://coordinator.local.han.guru:41957/graphql";
const POLL_INTERVAL = 10000; // 10 seconds

const ACTIVITY_QUERY = `
  query ActivityStatus {
    sessions(first: 10) {
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
	const [status, setStatus] = useState<ActivityStatus>({
		state: "checking",
		activeSessions: 0,
	});

	useEffect(() => {
		async function checkActivity() {
			try {
				const response = await fetch(COORDINATOR_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ query: ACTIVITY_QUERY }),
				});

				if (!response.ok) {
					setStatus({ state: "disconnected", activeSessions: 0 });
					return;
				}

				const data = await response.json();

				// Count sessions updated in the last 5 minutes as "active"
				const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
				const activeSessions =
					data?.data?.sessions?.edges?.filter(
						(edge: { node: { updatedAt: string } }) => {
							const updatedAt = new Date(edge.node.updatedAt).getTime();
							return updatedAt > fiveMinutesAgo;
						},
					)?.length ?? 0;

				setStatus({
					state: "connected",
					activeSessions,
				});
			} catch {
				setStatus({ state: "disconnected", activeSessions: 0 });
			}
		}

		// Initial check
		checkActivity();

		// Poll periodically
		const interval = setInterval(checkActivity, POLL_INTERVAL);

		return () => clearInterval(interval);
	}, []);

	// Still checking - show subtle indicator
	if (status.state === "checking") {
		return (
			<div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
				<span className="relative flex h-2 w-2">
					<span className="animate-pulse relative inline-flex rounded-full h-2 w-2 bg-gray-400" />
				</span>
			</div>
		);
	}

	// Not connected - don't show anything
	if (status.state === "disconnected") {
		return null;
	}

	return (
		<a
			href="https://coordinator.local.han.guru:41957"
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
			title={`Han coordinator running${status.activeSessions > 0 ? ` - ${status.activeSessions} active session${status.activeSessions === 1 ? "" : "s"}` : ""}`}
		>
			<span className="relative flex h-2 w-2">
				{status.activeSessions > 0 ? (
					<>
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
						<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
					</>
				) : (
					<span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400" />
				)}
			</span>
			<span className="text-xs text-gray-600 dark:text-gray-400 hidden sm:inline">
				{status.activeSessions > 0 ? `${status.activeSessions}` : ""}
			</span>
		</a>
	);
}
