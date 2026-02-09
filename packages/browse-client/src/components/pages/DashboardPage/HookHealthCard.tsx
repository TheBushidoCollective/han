/**
 * Hook Health Card Component
 *
 * Shows hook pass/fail rates with progress bars and average durations.
 * Sorted by failure rate descending (worst-performing hooks first).
 */

import type React from "react";
import { useMemo } from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface HookHealthStats {
	readonly hookName: string;
	readonly totalRuns: number;
	readonly passCount: number;
	readonly failCount: number;
	readonly passRate: number;
	readonly avgDurationMs: number;
}

interface HookHealthCardProps {
	hookHealth: readonly HookHealthStats[];
}

const COLORS = {
	pass: "#10b981", // Green
	fail: "#ef4444", // Red
};

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	if (ms < 60_000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	return `${(ms / 60_000).toFixed(1)}m`;
}

/**
 * Get pass rate display color
 */
function getPassRateColor(rate: number): string {
	if (rate >= 0.95) return "#10b981"; // Green
	if (rate >= 0.8) return "#f59e0b"; // Amber
	return "#ef4444"; // Red
}

export function HookHealthCard({
	hookHealth,
}: HookHealthCardProps): React.ReactElement {
	// Sort by failure rate descending (worst first)
	const sorted = useMemo(
		() =>
			[...hookHealth].sort((a, b) => {
				const aFailRate = 1 - a.passRate;
				const bFailRate = 1 - b.passRate;
				return bFailRate - aFailRate;
			}),
		[hookHealth],
	);

	// Overall summary
	const summary = useMemo(() => {
		const passingHooks = hookHealth.filter((h) => h.passRate >= 0.95).length;
		return { passing: passingHooks, total: hookHealth.length };
	}, [hookHealth]);

	// No data state
	if (hookHealth.length === 0) {
		return (
			<VStack
				gap="md"
				align="center"
				justify="center"
				style={{ minHeight: "120px" }}
			>
				<Text color="muted" size="sm">
					No hook execution data available
				</Text>
			</VStack>
		);
	}

	return (
		<VStack gap="md" style={{ width: "100%" }}>
			{/* Overall summary */}
			<HStack justify="space-between" align="center">
				<Text color="secondary" size="xs">
					Hook Health Overview
				</Text>
				<HStack gap="xs" align="center">
					<Text
						weight="semibold"
						size="sm"
						style={{
							color: summary.passing === summary.total ? "#10b981" : "#f59e0b",
						}}
					>
						{summary.passing}/{summary.total}
					</Text>
					<Text color="muted" size="xs">
						hooks passing
					</Text>
				</HStack>
			</HStack>

			{/* Hook rows */}
			<VStack gap="sm" style={{ width: "100%" }}>
				{sorted.map((hook) => {
					const passPercent = hook.passRate * 100;
					const failPercent = (1 - hook.passRate) * 100;
					const rateColor = getPassRateColor(hook.passRate);

					return (
						<VStack key={hook.hookName} gap="xs" style={{ width: "100%" }}>
							{/* Hook name and stats */}
							<HStack
								justify="space-between"
								align="center"
								style={{ width: "100%" }}
							>
								<Text size="xs" color="secondary" numberOfLines={1}>
									{hook.hookName}
								</Text>
								<HStack gap="sm" align="center">
									<Text
										size="xs"
										weight="semibold"
										style={{ color: rateColor }}
									>
										{passPercent.toFixed(0)}%
									</Text>
									<Text color="muted" size="xs">
										{formatDuration(hook.avgDurationMs)}
									</Text>
								</HStack>
							</HStack>

							{/* Pass/fail progress bar */}
							<Box
								style={{
									display: "flex",
									flexDirection: "row",
									height: 6,
									borderRadius: theme.radii.sm,
									overflow: "hidden",
									backgroundColor: theme.colors.bg.tertiary,
									width: "100%",
								}}
							>
								{passPercent > 0 && (
									<Box
										style={{
											width: `${passPercent}%`,
											height: "100%",
											backgroundColor: COLORS.pass,
										}}
									/>
								)}
								{failPercent > 0 && (
									<Box
										style={{
											width: `${failPercent}%`,
											height: "100%",
											backgroundColor: COLORS.fail,
										}}
									/>
								)}
							</Box>

							{/* Pass/fail counts */}
							<HStack
								justify="space-between"
								align="center"
								style={{ width: "100%" }}
							>
								<Text size="xs" style={{ color: COLORS.pass }}>
									{hook.passCount} passed
								</Text>
								{hook.failCount > 0 && (
									<Text size="xs" style={{ color: COLORS.fail }}>
										{hook.failCount} failed
									</Text>
								)}
							</HStack>
						</VStack>
					);
				})}
			</VStack>

			{/* Legend */}
			<HStack gap="md" align="center">
				<HStack gap="xs" align="center">
					<Box
						style={{
							width: "10px",
							height: "10px",
							borderRadius: "2px",
							backgroundColor: COLORS.pass,
						}}
					/>
					<Text color="muted" size="xs">
						Passed
					</Text>
				</HStack>
				<HStack gap="xs" align="center">
					<Box
						style={{
							width: "10px",
							height: "10px",
							borderRadius: "2px",
							backgroundColor: COLORS.fail,
						}}
					/>
					<Text color="muted" size="xs">
						Failed
					</Text>
				</HStack>
			</HStack>
		</VStack>
	);
}
