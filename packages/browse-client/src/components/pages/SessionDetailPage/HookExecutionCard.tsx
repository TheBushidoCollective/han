/**
 * Hook Execution Card Component
 *
 * Displays details of a single hook execution with expandable output/error.
 */

import type { ReactElement } from "react";
import { useState } from "react";
import type { ViewStyle } from "react-native-web";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Pressable } from "@/components/atoms/Pressable.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { colors, fonts, radii, spacing } from "@/theme.ts";
import type { HookExecution } from "./types.ts";
import { formatMs, formatRelativeTime } from "./utils.ts";

interface HookExecutionCardProps {
	hook: HookExecution;
}

const cardStyle: ViewStyle = {
	backgroundColor: colors.bg.secondary,
	borderRadius: radii.md,
	overflow: "hidden",
};

const statusIndicatorBase: ViewStyle = {
	width: 4,
	alignSelf: "stretch",
	flexShrink: 0,
};

const statusIconBase: ViewStyle = {
	width: 20,
	height: 20,
	borderRadius: radii.full,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 11,
	fontWeight: 600,
	flexShrink: 0,
};

const codeBlockStyle: ViewStyle = {
	margin: 0,
	padding: spacing.md,
	backgroundColor: colors.bg.primary,
	borderRadius: radii.sm,
	fontSize: 12,
	fontFamily: fonts.mono,
	color: colors.text.primary,
	overflow: "auto",
	maxHeight: 300,
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
};

const toggleButtonStyle: ViewStyle = {
	backgroundColor: "transparent",
	padding: `${spacing.xs}px 0`,
	flexDirection: "row",
	alignItems: "center",
	gap: spacing.xs,
};

function getHookTypeBadgeVariant(
	hookType: string,
): "info" | "purple" | "default" {
	const type = hookType.toLowerCase();
	if (type === "sessionstart") return "info";
	if (type === "userpromptsubmit") return "purple";
	return "default";
}

export function HookExecutionCard({
	hook,
}: HookExecutionCardProps): ReactElement {
	const [showDetails, setShowDetails] = useState(false);

	const statusIndicatorStyle: ViewStyle = {
		...statusIndicatorBase,
		backgroundColor: hook.passed ? colors.success : colors.danger,
	};

	const statusIconStyle: ViewStyle = {
		...statusIconBase,
		backgroundColor: hook.passed
			? "rgba(63, 185, 80, 0.15)"
			: "rgba(248, 81, 73, 0.15)",
		color: hook.passed ? colors.success : colors.danger,
	};

	return (
		<Box style={cardStyle}>
			<HStack gap="xs" align="stretch">
				{/* Status indicator bar */}
				<Box style={statusIndicatorStyle} />

				<VStack p="sm" gap="sm" flex={1}>
					{/* Header row */}
					<HStack justify="space-between" align="center">
						<HStack gap="sm" align="center">
							<Box style={statusIconStyle}>
								<Text size="xs">{hook.passed ? "✓" : "✗"}</Text>
							</Box>
							<Text weight="medium">{hook.hookName}</Text>
						</HStack>
						<Badge variant={getHookTypeBadgeVariant(hook.hookType)}>
							{hook.hookType}
						</Badge>
					</HStack>

					{/* Meta row */}
					<HStack gap="md" align="center" style={{ flexWrap: "wrap" }}>
						{hook.hookSource && (
							<Text size="sm" color="muted">
								from{" "}
								<Text
									size="sm"
									style={{ color: colors.text.primary, fontWeight: 500 }}
								>
									{hook.hookSource}
								</Text>
							</Text>
						)}
						<HStack gap="xs" align="center">
							<Box
								style={{
									width: 6,
									height: 6,
									borderRadius: radii.full,
									backgroundColor: colors.text.muted,
									opacity: 0.5,
								}}
							/>
							<Text size="sm" color="muted">
								{formatMs(hook.durationMs)}
							</Text>
						</HStack>
						<Text size="sm" color="muted">
							{formatRelativeTime(hook.timestamp)}
						</Text>
					</HStack>

					{/* Directory row */}
					{hook.directory && (
						<Text size="sm" color="muted">
							dir{" "}
							<Text
								size="sm"
								style={{ color: colors.text.primary, fontWeight: 500 }}
							>
								{hook.directory}
							</Text>
						</Text>
					)}

					{/* Expandable output section */}
					{(hook.output || hook.error) && (
						<VStack gap="sm">
							<Pressable
								onPress={() => setShowDetails(!showDetails)}
								style={toggleButtonStyle}
							>
								<Box
									style={{
										transform: showDetails
											? [{ rotate: "90deg" }]
											: [{ rotate: "0deg" }],
									}}
								>
									<Text size="sm" color="muted">
										▶
									</Text>
								</Box>
								<Text size="sm" color="muted">
									{showDetails ? "Hide output" : "Show output"}
								</Text>
							</Pressable>

							{showDetails && (
								<VStack gap="sm">
									{hook.error && (
										<VStack gap="xs">
											<Text
												size="sm"
												weight="semibold"
												style={{ color: colors.danger }}
											>
												Error
											</Text>
											<Box style={codeBlockStyle}>
												<Text
													size="sm"
													style={{
														fontFamily: fonts.mono,
														color: colors.text.primary,
													}}
												>
													{hook.error}
												</Text>
											</Box>
										</VStack>
									)}
									{hook.output && (
										<VStack gap="xs">
											<Text size="sm" weight="semibold" color="muted">
												Output
											</Text>
											<Box style={codeBlockStyle}>
												<Text
													size="sm"
													style={{
														fontFamily: fonts.mono,
														color: colors.text.primary,
													}}
												>
													{hook.output}
												</Text>
											</Box>
										</VStack>
									)}
								</VStack>
							)}
						</VStack>
					)}
				</VStack>
			</HStack>
		</Box>
	);
}
