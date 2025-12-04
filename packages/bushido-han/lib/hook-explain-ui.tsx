import { Box, Text } from "ink";
import type React from "react";
import type { SettingsScope } from "./claude-settings.js";

interface HookEntry {
	type: "command" | "prompt";
	command?: string;
	prompt?: string;
	timeout?: number;
}

export interface HookSource {
	source: string;
	scope?: SettingsScope;
	pluginName?: string;
	marketplace?: string;
	hookType: string;
	hooks: HookEntry[];
}

interface HookExplainUIProps {
	hooks: HookSource[];
	showAll: boolean;
}

const HookEntryDisplay: React.FC<{ hook: HookEntry; index: number }> = ({
	hook,
	index,
}) => {
	return (
		<Box flexDirection="column" marginLeft={4} marginTop={index > 0 ? 1 : 0}>
			<Box>
				<Text dimColor>Hook {index + 1}: </Text>
				<Text color={hook.type === "command" ? "blue" : "magenta"} bold>
					{hook.type}
				</Text>
			</Box>

			{hook.command && (
				<Box marginLeft={2} flexDirection="column">
					<Text dimColor>Command:</Text>
					<Box marginLeft={2}>
						<Text color="gray">{hook.command}</Text>
					</Box>
				</Box>
			)}

			{hook.prompt && (
				<Box marginLeft={2} flexDirection="column">
					<Text dimColor>Prompt:</Text>
					<Box marginLeft={2} flexDirection="column">
						{hook.prompt.split("\n").map((line, i) => (
							<Text key={i} color="gray">
								{line}
							</Text>
						))}
					</Box>
				</Box>
			)}

			{hook.timeout && (
				<Box marginLeft={2}>
					<Text dimColor>Timeout: </Text>
					<Text>{hook.timeout}ms</Text>
				</Box>
			)}
		</Box>
	);
};

const HookSourceDisplay: React.FC<{ source: HookSource }> = ({ source }) => {
	return (
		<Box flexDirection="column" marginTop={1}>
			{source.pluginName ? (
				<Box>
					<Text color="green" bold>
						{source.pluginName}
					</Text>
					<Text dimColor>@{source.marketplace}</Text>
				</Box>
			) : (
				<Box>
					<Text color="yellow" bold>
						Settings
					</Text>
					<Text dimColor> ({source.scope})</Text>
				</Box>
			)}

			<Box marginLeft={2}>
				<Text dimColor>Path: </Text>
				<Text color="cyan">{source.source}</Text>
			</Box>

			{source.hooks.map((hook, i) => (
				<HookEntryDisplay key={i} hook={hook} index={i} />
			))}
		</Box>
	);
};

const HookTypeSection: React.FC<{ hookType: string; sources: HookSource[] }> = ({
	hookType,
	sources,
}) => {
	return (
		<Box flexDirection="column" marginTop={1}>
			<Box>
				<Text color="cyan" bold>
					{hookType}
				</Text>
				<Text dimColor> ({sources.length} source{sources.length !== 1 ? "s" : ""})</Text>
			</Box>
			<Box marginLeft={2}>
				<Text dimColor>{"─".repeat(50)}</Text>
			</Box>

			{sources.map((source, i) => (
				<Box key={i} marginLeft={2}>
					<HookSourceDisplay source={source} />
				</Box>
			))}
		</Box>
	);
};

export const HookExplainUI: React.FC<HookExplainUIProps> = ({
	hooks,
	showAll,
}) => {
	if (hooks.length === 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="yellow">No hooks configured.</Text>
				{!showAll && (
					<Text dimColor>
						Use --all to include hooks from Claude Code settings.
					</Text>
				)}
			</Box>
		);
	}

	// Group by hook type
	const byType = new Map<string, HookSource[]>();
	for (const hook of hooks) {
		const existing = byType.get(hook.hookType) || [];
		existing.push(hook);
		byType.set(hook.hookType, existing);
	}

	// Sort hook types
	const sortedTypes = Array.from(byType.keys()).sort();

	// Calculate summary
	const commandHooks = hooks.flatMap((h) =>
		h.hooks.filter((e) => e.type === "command"),
	);
	const promptHooks = hooks.flatMap((h) =>
		h.hooks.filter((e) => e.type === "prompt"),
	);

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box flexDirection="column">
				<Text color="cyan" bold>
					{"═".repeat(60)}
				</Text>
				<Text color="white" bold>
					CONFIGURED HOOKS {showAll ? "(all sources)" : "(Han plugins only)"}
				</Text>
				<Text color="cyan" bold>
					{"═".repeat(60)}
				</Text>
			</Box>

			{/* Hook Types */}
			{sortedTypes.map((type) => {
				const sources = byType.get(type);
				if (!sources) return null;
				return <HookTypeSection key={type} hookType={type} sources={sources} />;
			})}

			{/* Summary */}
			<Box flexDirection="column" marginTop={2}>
				<Text color="cyan" bold>
					{"═".repeat(60)}
				</Text>
				<Text color="white" bold>
					SUMMARY
				</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text dimColor>Total hook sources: </Text>
						<Text bold>{hooks.length}</Text>
					</Box>
					<Box>
						<Text dimColor>Command hooks: </Text>
						<Text color="blue" bold>
							{commandHooks.length}
						</Text>
					</Box>
					<Box>
						<Text dimColor>Prompt hooks: </Text>
						<Text color="magenta" bold>
							{promptHooks.length}
						</Text>
					</Box>
					<Box>
						<Text dimColor>Hook types: </Text>
						<Text>{sortedTypes.join(", ") || "none"}</Text>
					</Box>
				</Box>
			</Box>

			{/* Notes */}
			<Box flexDirection="column" marginTop={1}>
				<Text color="yellow" bold>
					NOTE:
				</Text>
				<Box marginLeft={2} flexDirection="column">
					<Text dimColor>
						• Command hooks execute shell commands and can block (return
						non-zero exit)
					</Text>
					<Text dimColor>
						• Prompt hooks inject text into context (cannot block, handled by
						Claude Code)
					</Text>
					<Text dimColor>
						• The 'han hook dispatch' command only runs command hooks, not
						prompt hooks
					</Text>
				</Box>
			</Box>
		</Box>
	);
};
