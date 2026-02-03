"use client";

import { useEffect, useState } from "react";

const COORDINATOR_WS_URL = "wss://coordinator.local.han.guru:41957/graphql";

export function ActivityIndicator() {
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		let ws: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

		function connect() {
			ws = new WebSocket(COORDINATOR_WS_URL, "graphql-transport-ws");
			ws.onopen = () => ws?.send(JSON.stringify({ type: "connection_init" }));
			ws.onmessage = (e) => {
				if (JSON.parse(e.data).type === "connection_ack") setConnected(true);
			};
			ws.onclose = () => {
				setConnected(false);
				reconnectTimer = setTimeout(connect, 5000);
			};
			ws.onerror = () => ws?.close();
		}

		connect();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
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
				<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
				<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
			</span>
		</a>
	);
}
