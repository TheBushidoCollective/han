/**
 * Connection Overlay
 *
 * Full-viewport overlay shown when the coordinator is disconnected.
 * Displays a spinner, connection status, and actionable steps to
 * get the coordinator running.
 */

import type React from "react";
import { useEffect, useState } from "react";
import { isBlockedByLocalNetworkAccess } from "../../helpers/localNetworkAccess.ts";
import { colors, fontSizes, fonts, radii, spacing } from "../../theme.ts";
import { Box, Heading, Spinner, Text, VStack } from "../atoms/index.ts";

const overlayStyle = {
	position: "fixed" as const,
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	zIndex: 100,
	backgroundColor: colors.bg.primary,
	display: "flex" as const,
	alignItems: "center" as const,
	justifyContent: "center" as const,
};

const contentBoxStyle = {
	maxWidth: 520,
	width: "100%",
	paddingTop: spacing.xxl,
	paddingBottom: spacing.xxl,
	paddingLeft: spacing.xxl,
	paddingRight: spacing.xxl,
	backgroundColor: colors.bg.secondary,
	borderRadius: radii.lg,
	borderWidth: 1,
	borderColor: colors.border.default,
	borderStyle: "solid" as const,
};

const codeBlockStyle = {
	backgroundColor: colors.bg.primary,
	borderRadius: radii.sm,
	paddingTop: spacing.md,
	paddingBottom: spacing.md,
	paddingLeft: spacing.lg,
	paddingRight: spacing.lg,
	fontFamily: fonts.mono,
	fontSize: fontSizes.sm,
	color: colors.text.primary,
};

const stepNumberStyle = {
	width: 24,
	height: 24,
	borderRadius: radii.full,
	backgroundColor: colors.bg.tertiary,
	display: "flex" as const,
	alignItems: "center" as const,
	justifyContent: "center" as const,
	flexShrink: 0,
};

interface StepProps {
	number: number;
	title: string;
	code?: string;
	children?: React.ReactNode;
}

function Step({
	number,
	title,
	code,
	children,
}: StepProps): React.ReactElement {
	return (
		<Box
			style={{
				display: "flex",
				flexDirection: "row" as const,
				gap: spacing.md,
			}}
		>
			<Box style={stepNumberStyle}>
				<Text size="xs" weight="semibold" color="muted">
					{number}
				</Text>
			</Box>
			<VStack gap="xs" style={{ flex: 1 }}>
				<Text size="sm" weight="medium">
					{title}
				</Text>
				{code && (
					<Box style={codeBlockStyle}>
						<Text size="sm" style={{ fontFamily: fonts.mono }}>
							{code}
						</Text>
					</Box>
				)}
				{children}
			</VStack>
		</Box>
	);
}

/**
 * Shown when the browser, not the coordinator, is the obstacle.
 *
 * No spinner and no "checking every 3 seconds": this will not resolve by
 * waiting, and a spinner would imply otherwise. `han browse` serves this same
 * dashboard from 127.0.0.1, which is not gated.
 */
function LocalNetworkBlockedPanel(): React.ReactElement {
	return (
		<Box style={overlayStyle}>
			<Box style={contentBoxStyle}>
				<VStack gap="xl" align="center">
					<VStack gap="sm" align="center">
						<Heading size="md">Open the dashboard from your machine</Heading>
						<Text
							color="muted"
							size="sm"
							style={{ textAlign: "center" as const }}
						>
							Your coordinator may well be running. This page is served from{" "}
							{window.location.host}, and browsers block a page on a public
							address from reaching one on your own machine, so it cannot read
							the coordinator from here.
						</Text>
					</VStack>

					<Box
						style={{
							width: "100%",
							height: 1,
							backgroundColor: colors.border.subtle,
						}}
					/>

					<VStack gap="lg" style={{ width: "100%" }}>
						<Step number={1} title="Run this instead:" code="han browse">
							<Text color="muted" size="xs">
								It serves this dashboard from 127.0.0.1 and opens it for you.
								Same dashboard, an address the browser allows.
							</Text>
						</Step>

						<Step number={2} title="Need to install Han?">
							<VStack gap="xs">
								<Box style={codeBlockStyle}>
									<Text size="sm" style={{ fontFamily: fonts.mono }}>
										curl -fsSL https://han.guru/install.sh | bash
									</Text>
								</Box>
								<Text color="muted" size="xs">
									or
								</Text>
								<Box style={codeBlockStyle}>
									<Text size="sm" style={{ fontFamily: fonts.mono }}>
										brew install thebushidocollective/tap/han
									</Text>
								</Box>
							</VStack>
						</Step>
					</VStack>
				</VStack>
			</Box>
		</Box>
	);
}

export function ConnectionOverlay(): React.ReactElement {
	const [pulseVisible, setPulseVisible] = useState(true);
	// Read once: neither the page origin nor the configured endpoint changes
	// without a reload, and this decides whether waiting is even meaningful.
	const [blocked] = useState(() => isBlockedByLocalNetworkAccess());

	useEffect(() => {
		if (blocked) {
			return;
		}
		const interval = setInterval(() => {
			setPulseVisible((v) => !v);
		}, 1500);
		return () => clearInterval(interval);
	}, [blocked]);

	if (blocked) {
		return <LocalNetworkBlockedPanel />;
	}

	return (
		<Box style={overlayStyle}>
			<Box style={contentBoxStyle}>
				<VStack gap="xl" align="center">
					<Spinner size="lg" />

					<VStack gap="sm" align="center">
						<Heading size="md">Connecting to Han Coordinator...</Heading>
						<Text
							color="muted"
							size="sm"
							style={{ textAlign: "center" as const }}
						>
							The coordinator provides session data and analytics for the
							dashboard.
						</Text>
					</VStack>

					<Box
						style={{
							width: "100%",
							height: 1,
							backgroundColor: colors.border.subtle,
						}}
					/>

					<VStack gap="lg" style={{ width: "100%" }}>
						<Step number={1} title="Start a Claude Code session">
							<Text color="muted" size="xs">
								The coordinator starts automatically with any Claude Code
								session.
							</Text>
						</Step>

						<Step
							number={2}
							title="Or start manually:"
							code="han coordinator start"
						/>

						<Step number={3} title="Need to install Han?">
							<VStack gap="xs">
								<Box style={codeBlockStyle}>
									<Text size="sm" style={{ fontFamily: fonts.mono }}>
										curl -fsSL https://han.guru/install.sh | bash
									</Text>
								</Box>
								<Text color="muted" size="xs">
									or
								</Text>
								<Box style={codeBlockStyle}>
									<Text size="sm" style={{ fontFamily: fonts.mono }}>
										brew install thebushidocollective/tap/han
									</Text>
								</Box>
							</VStack>
						</Step>
					</VStack>

					<Text
						color="muted"
						size="xs"
						style={{ opacity: pulseVisible ? 1 : 0.4 }}
					>
						Checking every 3 seconds...
					</Text>
				</VStack>
			</Box>
		</Box>
	);
}
