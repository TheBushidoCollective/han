/**
 * Stat Item Component
 *
 * Displays a statistic with value and label.
 */

import type React from "react";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

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
