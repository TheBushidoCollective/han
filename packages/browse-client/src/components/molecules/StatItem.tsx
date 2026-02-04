/**
 * Stat Item Molecule
 *
 * Displays a statistic with value and label in vertical layout.
 * Used for prominent numeric displays.
 */

import type React from "react";
import { Text, VStack } from "../atoms/index.ts";

interface StatItemProps {
	value: string | number;
	label: string;
}

export function StatItem({ value, label }: StatItemProps): React.ReactElement {
	return (
		<VStack gap="xs" align="center">
			<Text size="lg" weight="semibold">
				{value}
			</Text>
			<Text size="xs" color="muted">
				{label}
			</Text>
		</VStack>
	);
}
