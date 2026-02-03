/**
 * Token Usage Card Component
 *
 * Displays token usage statistics and estimated costs.
 * Shows breakdown of input, output, and cached tokens.
 */

import type React from "react";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

interface TokenUsageStats {
	readonly totalInputTokens: number;
	readonly totalOutputTokens: number;
	readonly totalCachedTokens: number;
	readonly totalTokens: number;
	readonly estimatedCostUsd: number;
	readonly messageCount: number;
	readonly sessionCount: number;
}

interface TokenUsageCardProps {
	tokenUsage: TokenUsageStats;
}

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1)}M`;
	}
	if (num >= 1_000) {
		return `${(num / 1_000).toFixed(1)}K`;
	}
	return num.toLocaleString();
}

/**
 * Format currency
 */
function formatCost(usd: number): string {
	if (usd < 0.01) return "< $0.01";
	if (usd < 1) return `$${usd.toFixed(2)}`;
	if (usd < 100) return `$${usd.toFixed(2)}`;
	return `$${usd.toFixed(0)}`;
}

/**
 * Token stat item
 */
function TokenStat({
	label,
	value,
	color,
	subValue,
}: {
	label: string;
	value: string;
	color: string;
	subValue?: string;
}): React.ReactElement {
	return (
		<VStack gap="xs" style={{ minWidth: "100px" }}>
			<HStack gap="xs" align="center">
				<Box
					style={{
						width: "8px",
						height: "8px",
						borderRadius: "50%",
						backgroundColor: color,
					}}
				/>
				<Text color="secondary" size="xs">
					{label}
				</Text>
			</HStack>
			<Text weight="semibold" size="lg">
				{value}
			</Text>
			{subValue && (
				<Text color="muted" size="xs">
					{subValue}
				</Text>
			)}
		</VStack>
	);
}

export function TokenUsageCard({
	tokenUsage,
}: TokenUsageCardProps): React.ReactElement {
	// Calculate percentages for the bar
	const total =
		tokenUsage.totalInputTokens +
		tokenUsage.totalOutputTokens +
		tokenUsage.totalCachedTokens;
	const inputPercent =
		total > 0 ? (tokenUsage.totalInputTokens / total) * 100 : 0;
	const outputPercent =
		total > 0 ? (tokenUsage.totalOutputTokens / total) * 100 : 0;
	const cachedPercent =
		total > 0 ? (tokenUsage.totalCachedTokens / total) * 100 : 0;

	// Calculate cost per session/message averages
	const avgTokensPerSession =
		tokenUsage.sessionCount > 0
			? Math.round(tokenUsage.totalTokens / tokenUsage.sessionCount)
			: 0;
	const avgCostPerSession =
		tokenUsage.sessionCount > 0
			? tokenUsage.estimatedCostUsd / tokenUsage.sessionCount
			: 0;

	return (
		<VStack gap="md">
			{/* Cost headline */}
			<HStack justify="space-between" align="center">
				<VStack gap="xs">
					<Text color="secondary" size="xs">
						Estimated Cost (30 days)
					</Text>
					<Text
						weight="bold"
						style={{
							fontSize: "28px",
							color: theme.colors.accent.primary,
						}}
					>
						{formatCost(tokenUsage.estimatedCostUsd)}
					</Text>
				</VStack>
				<VStack gap="xs" align="flex-end">
					<Text color="muted" size="xs">
						{tokenUsage.sessionCount} sessions
					</Text>
					<Text color="muted" size="xs">
						{formatCost(avgCostPerSession)} / session avg
					</Text>
				</VStack>
			</HStack>

			{/* Token distribution bar */}
			<VStack gap="xs">
				<Text color="secondary" size="xs">
					Token Distribution
				</Text>
				<Box
					style={{
						display: "flex",
						height: "12px",
						borderRadius: "6px",
						overflow: "hidden",
						backgroundColor: theme.colors.bg.tertiary,
					}}
				>
					{inputPercent > 0 && (
						<div
							title={`Input: ${formatNumber(tokenUsage.totalInputTokens)} tokens (${inputPercent.toFixed(1)}%)`}
							style={{
								width: `${inputPercent}%`,
								backgroundColor: "#3b82f6",
								cursor: "pointer",
							}}
						/>
					)}
					{outputPercent > 0 && (
						<div
							title={`Output: ${formatNumber(tokenUsage.totalOutputTokens)} tokens (${outputPercent.toFixed(1)}%)`}
							style={{
								width: `${outputPercent}%`,
								backgroundColor: "#10b981",
								cursor: "pointer",
							}}
						/>
					)}
					{cachedPercent > 0 && (
						<div
							title={`Cached: ${formatNumber(tokenUsage.totalCachedTokens)} tokens (${cachedPercent.toFixed(1)}%)`}
							style={{
								width: `${cachedPercent}%`,
								backgroundColor: "#8b5cf6",
								cursor: "pointer",
							}}
						/>
					)}
				</Box>
			</VStack>

			{/* Token breakdown */}
			<HStack gap="lg" wrap>
				<TokenStat
					label="Input"
					value={formatNumber(tokenUsage.totalInputTokens)}
					color="#3b82f6"
					subValue={`${inputPercent.toFixed(0)}% of total`}
				/>
				<TokenStat
					label="Output"
					value={formatNumber(tokenUsage.totalOutputTokens)}
					color="#10b981"
					subValue={`${outputPercent.toFixed(0)}% of total`}
				/>
				<TokenStat
					label="Cached"
					value={formatNumber(tokenUsage.totalCachedTokens)}
					color="#8b5cf6"
					subValue={`${cachedPercent.toFixed(0)}% of total`}
				/>
				<TokenStat
					label="Total"
					value={formatNumber(tokenUsage.totalTokens)}
					color={theme.colors.text.primary}
					subValue={`${formatNumber(avgTokensPerSession)} / session`}
				/>
			</HStack>

			{/* Savings callout */}
			{tokenUsage.totalCachedTokens > 0 && (
				<Box
					style={{
						padding: theme.spacing.sm,
						backgroundColor: "rgba(139, 92, 246, 0.1)",
						borderRadius: theme.borderRadius.md,
						borderLeft: "3px solid #8b5cf6",
					}}
				>
					<Text size="sm" color="secondary">
						Cache savings: ~
						{formatCost((tokenUsage.totalCachedTokens / 1_000_000) * 2.7)} saved
						by using cached tokens instead of full input tokens
					</Text>
				</Box>
			)}
		</VStack>
	);
}
