/**
 * Stat Card Organism
 *
 * Displays a statistic with label, value, and optional sub-value.
 * Unified component for all stat display needs across the app.
 *
 * Layout variants:
 * - "label-first" (default): Label on top, value below (dashboard style)
 * - "value-first": Value on top, label below (metrics style)
 */

import type React from "react";
import { Card, Heading, Text, theme, VStack } from "../atoms/index.ts";

interface StatCardProps {
	label: string;
	value: string | number;
	subValue?: string;
	onClick?: () => void;
	centered?: boolean;
	/** Layout variant: "label-first" shows label above value, "value-first" shows value above label */
	variant?: "label-first" | "value-first";
	/** Custom color for the value text (e.g., for status indicators) */
	valueColor?: string;
	/** Compact mode: smaller padding, inline badge-like appearance */
	compact?: boolean;
}

export function StatCard({
	label,
	value,
	subValue,
	onClick,
	centered = false,
	variant = "label-first",
	valueColor,
	compact = false,
}: StatCardProps): React.ReactElement {
	const isValueFirst = variant === "value-first";

	// Compact mode uses smaller padding and inline styling (for status badges)
	const cardStyle = compact
		? {
				backgroundColor: theme.colors.bg.secondary,
				borderRadius: theme.radii.md,
				padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
				minWidth: 80,
				textAlign: "center" as const,
			}
		: centered
			? { padding: theme.spacing.md, textAlign: "center" as const }
			: undefined;

	// In compact mode, don't use Card wrapper, just a Box with custom styling
	if (compact) {
		return (
			<VStack gap="xs" style={cardStyle}>
				<Text
					size="lg"
					weight="bold"
					style={valueColor ? { color: valueColor } : undefined}
				>
					{value}
				</Text>
				<Text size="xs" color="muted">
					{label}
				</Text>
			</VStack>
		);
	}

	return (
		<Card onClick={onClick} hoverable={!!onClick} style={cardStyle}>
			<VStack gap="xs" align={centered ? "center" : undefined}>
				{isValueFirst ? (
					<>
						<Text
							size="xl"
							weight="semibold"
							style={valueColor ? { color: valueColor } : undefined}
						>
							{value}
						</Text>
						<Text color="secondary" size="sm">
							{label}
						</Text>
					</>
				) : (
					<>
						<Text color="secondary" size="sm">
							{label}
						</Text>
						<Heading
							size="xl"
							style={valueColor ? { color: valueColor } : undefined}
						>
							{value}
						</Heading>
					</>
				)}
				{subValue && (
					<Text color="muted" size="xs">
						{subValue}
					</Text>
				)}
			</VStack>
		</Card>
	);
}
