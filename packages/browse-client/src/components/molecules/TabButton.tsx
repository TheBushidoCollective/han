/**
 * Tab Button Molecule
 *
 * Styled tab button for switching between views.
 * Combines Box and Text atoms for interactive tab navigation.
 */

import type React from "react";
import { Box, Text, theme } from "../atoms/index.ts";

interface TabButtonProps {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}

export function TabButton({
	active,
	onClick,
	children,
}: TabButtonProps): React.ReactElement {
	return (
		<Box
			onClick={onClick}
			px="md"
			py="sm"
			borderRadius="md"
			bg={active ? "tertiary" : undefined}
			style={{
				cursor: "pointer",
				color: active ? theme.colors.text.primary : theme.colors.text.secondary,
				fontWeight: active ? 500 : 400,
				transition: "background-color 0.2s, color 0.2s",
			}}
		>
			<Text size="sm" color={active ? "primary" : "secondary"}>
				{children}
			</Text>
		</Box>
	);
}
