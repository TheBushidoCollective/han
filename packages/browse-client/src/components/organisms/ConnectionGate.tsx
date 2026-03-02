/**
 * Connection Gate
 *
 * Wraps the app and manages coordinator connectivity state.
 * When disconnected: shows ConnectionOverlay as a full-screen pane.
 * When connected: fades out overlay, then mounts real app.
 * Handles mid-session disconnects by unmounting the real app and
 * resetting the Relay environment.
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCoordinatorHealth } from "../../hooks/useCoordinatorHealth.ts";
import { resetRelayEnvironment } from "../../relay/environment.ts";
import { Box } from "../atoms/index.ts";
import { ConnectionOverlay } from "./ConnectionOverlay.tsx";

type GatePhase = "disconnected" | "transitioning" | "connected";

const OVERLAY_FADE_MS = 200;

interface ConnectionGateProps {
	children: React.ReactNode;
}

export function ConnectionGate({
	children,
}: ConnectionGateProps): React.ReactElement {
	const { isConnected } = useCoordinatorHealth();
	const [phase, setPhase] = useState<GatePhase>(
		isConnected ? "connected" : "disconnected",
	);
	const wasConnectedRef = useRef(isConnected);
	const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const startTransitionToConnected = useCallback(() => {
		setPhase("transitioning");
		transitionTimerRef.current = setTimeout(() => {
			setPhase("connected");
		}, OVERLAY_FADE_MS);
	}, []);

	useEffect(() => {
		if (isConnected && phase === "disconnected") {
			// Coordinator came online
			if (wasConnectedRef.current) {
				// Reconnecting after a disconnect - reset Relay environment
				resetRelayEnvironment();
			}
			wasConnectedRef.current = true;
			startTransitionToConnected();
		} else if (!isConnected && phase === "connected") {
			// Coordinator went offline mid-session
			if (transitionTimerRef.current) {
				clearTimeout(transitionTimerRef.current);
			}
			setPhase("disconnected");
		} else if (!isConnected && phase === "transitioning") {
			// Lost connection during transition
			if (transitionTimerRef.current) {
				clearTimeout(transitionTimerRef.current);
			}
			setPhase("disconnected");
		}
	}, [isConnected, phase, startTransitionToConnected]);

	useEffect(() => {
		return () => {
			if (transitionTimerRef.current) {
				clearTimeout(transitionTimerRef.current);
			}
		};
	}, []);

	if (phase === "connected") {
		return <>{children}</>;
	}

	// Transitioning: render children behind a fading overlay so Relay
	// queries start fetching while the overlay fades out.
	if (phase === "transitioning") {
		return (
			<>
				{children}
				<Box
					style={{
						position: "fixed" as const,
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						zIndex: 100,
						opacity: 0,
						transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
						pointerEvents: "none" as const,
					}}
				>
					<ConnectionOverlay />
				</Box>
			</>
		);
	}

	// Disconnected: show overlay as standalone pane
	return <ConnectionOverlay />;
}
