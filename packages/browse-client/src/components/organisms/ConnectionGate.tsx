/**
 * Connection Gate
 *
 * Wraps the app and manages coordinator connectivity state.
 * When disconnected: shows a blurred MockDashboard with ConnectionOverlay.
 * When connected: fades out overlay, un-blurs, then mounts real app.
 * Handles mid-session disconnects by unmounting the real app and
 * resetting the Relay environment.
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCoordinatorHealth } from "../../hooks/useCoordinatorHealth.ts";
import { resetRelayEnvironment } from "../../relay/environment.ts";
import { Box } from "../atoms/index.ts";
import { ConnectionOverlay } from "./ConnectionOverlay.tsx";
import { MockDashboard } from "./MockDashboard.tsx";

type GatePhase = "disconnected" | "transitioning" | "connected";

const OVERLAY_FADE_MS = 400;
const BLUR_FADE_MS = 600;

interface ConnectionGateProps {
	children: React.ReactNode;
}

export function ConnectionGate({
	children,
}: ConnectionGateProps): React.ReactElement {
	const { isConnected } = useCoordinatorHealth();
	const [phase, setPhase] = useState<GatePhase>("disconnected");
	const wasConnectedRef = useRef(false);
	const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const startTransitionToConnected = useCallback(() => {
		setPhase("transitioning");
		transitionTimerRef.current = setTimeout(() => {
			setPhase("connected");
		}, BLUR_FADE_MS);
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

	// Disconnected or transitioning: show mock + overlay
	const isTransitioning = phase === "transitioning";

	const mockContainerStyle = {
		filter: isTransitioning ? "blur(0px)" : "blur(4px)",
		transition: `filter ${BLUR_FADE_MS}ms ease`,
	};

	const pointerEvents: "none" | "auto" = isTransitioning ? "none" : "auto";
	const overlayContainerStyle = {
		opacity: isTransitioning ? 0 : 1,
		transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
		pointerEvents,
	};

	return (
		<>
			<Box style={mockContainerStyle}>
				<MockDashboard />
			</Box>
			<Box style={overlayContainerStyle}>
				<ConnectionOverlay />
			</Box>
		</>
	);
}
