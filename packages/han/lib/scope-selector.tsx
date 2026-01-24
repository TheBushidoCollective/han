import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";
import type { InstallScope } from "./shared.ts";

interface ScopeSelectorProps {
	onSelect: (scope: InstallScope) => void;
	onCancel: () => void;
}

const SCOPE_OPTIONS: Array<{
	scope: InstallScope;
	name: string;
	description: string;
}> = [
	{
		scope: "user",
		name: "User (global)",
		description: "~/.claude/settings.json - Shared across all projects",
	},
	{
		scope: "project",
		name: "Project",
		description: ".claude/settings.json - Shared with team via git",
	},
	{
		scope: "local",
		name: "Local",
		description:
			".claude/settings.local.json - Personal preferences (gitignored)",
	},
];

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
	onSelect,
	onCancel,
}) => {
	const [selectedIndex, setSelectedIndex] = useState(0);

	useInput((_input, key) => {
		if (key.upArrow) {
			setSelectedIndex(Math.max(0, selectedIndex - 1));
		} else if (key.downArrow) {
			setSelectedIndex(Math.min(SCOPE_OPTIONS.length - 1, selectedIndex + 1));
		} else if (key.return) {
			const selected = SCOPE_OPTIONS[selectedIndex];
			onSelect(selected.scope);
		} else if (key.escape) {
			onCancel();
		}
	});

	return (
		<Box flexDirection="column" paddingY={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Select installation scope:
				</Text>
			</Box>

			{SCOPE_OPTIONS.map((option, index) => {
				const isSelected = index === selectedIndex;

				return (
					<Box key={option.scope} marginLeft={1} flexDirection="column">
						<Text
							color={isSelected ? "cyan" : undefined}
							bold={isSelected}
							inverse={isSelected}
						>
							{isSelected ? "> " : "  "}
							{option.name}
						</Text>
						{isSelected && (
							<Box marginLeft={4}>
								<Text dimColor>{option.description}</Text>
							</Box>
						)}
					</Box>
				);
			})}

			<Box marginTop={1}>
				<Text dimColor>
					Use arrow keys to navigate, Enter to select, Esc to cancel
				</Text>
			</Box>
		</Box>
	);
};
