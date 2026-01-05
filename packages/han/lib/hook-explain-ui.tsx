import { Box, Text } from "ink";
import type React from "react";
import type { SettingsScope } from "./config/claude-settings.ts";
import type { HookDependency } from "./hook-config.ts";

/**
 * Hook entry - can be from han-plugin.yml (new) or legacy format
 */
interface HookEntry {
	name?: string;
	command: string;
	description?: string;
	dirsWith?: string[];
	ifChanged?: string[];
	toolFilter?: string[];
	tip?: string;
	dependsOn?: HookDependency[];
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
				<Text dimColor>
					{hook.name ? `${hook.name}: ` : `Hook ${index + 1}: `}
				</Text>
				<Text color="blue" bold>
					command
				</Text>
			</Box>

			{hook.description && (
				<Box marginLeft={2}>
					<Text dimColor>Description: </Text>
					<Text>{hook.description}</Text>
				</Box>
			)}

			<Box marginLeft={2} flexDirection="column">
				<Text dimColor>Command:</Text>
				<Box marginLeft={2}>
					<Text color="gray">{hook.command}</Text>
				</Box>
			</Box>

			{hook.dirsWith && hook.dirsWith.length > 0 && (
				<Box marginLeft={2}>
					<Text dimColor>Directories with: </Text>
					<Text color="yellow">{hook.dirsWith.join(", ")}</Text>
				</Box>
			)}

			{hook.ifChanged && hook.ifChanged.length > 0 && (
				<Box marginLeft={2}>
					<Text dimColor>If changed: </Text>
					<Text color="green">{hook.ifChanged.join(", ")}</Text>
				</Box>
			)}

			{hook.toolFilter && hook.toolFilter.length > 0 && (
				<Box marginLeft={2}>
					<Text dimColor>Tool filter: </Text>
					<Text color="magenta">{hook.toolFilter.join(", ")}</Text>
				</Box>
			)}

			{hook.dependsOn && hook.dependsOn.length > 0 && (
				<Box marginLeft={2}>
					<Text dimColor>Depends on: </Text>
					<Text color="cyan">
						{hook.dependsOn
							.map(
								(d) =>
									`${d.plugin}/${d.hook}${d.optional ? " (optional)" : ""}`,
							)
							.join(", ")}
					</Text>
				</Box>
			)}

			{hook.tip && (
				<Box marginLeft={2}>
					<Text dimColor>Tip: </Text>
					<Text color="yellow">{hook.tip}</Text>
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
					<Text dimColor>
						{" "}
						({source.hooks.length} hook{source.hooks.length !== 1 ? "s" : ""})
					</Text>
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

			{source.hooks.map((hook, hookIdx) => (
				<HookEntryDisplay
					key={`hook-${hookIdx}-${hook.name || hook.command.slice(0, 20)}`}
					hook={hook}
					index={hookIdx}
				/>
			))}
		</Box>
	);
};

const HookTypeSection: React.FC<{
	hookType: string;
	sources: HookSource[];
}> = ({ hookType, sources }) => {
	const totalHooks = sources.reduce((sum, s) => sum + s.hooks.length, 0);

	return (
		<Box flexDirection="column" marginTop={1}>
			<Box>
				<Text color="cyan" bold>
					{hookType}
				</Text>
				<Text dimColor>
					{" "}
					({sources.length} plugin{sources.length !== 1 ? "s" : ""},{" "}
					{totalHooks} hook{totalHooks !== 1 ? "s" : ""})
				</Text>
			</Box>
			<Box marginLeft={2}>
				<Text dimColor>{"─".repeat(50)}</Text>
			</Box>

			{sources.map((source) => (
				<Box
					key={`source-${source.source}-${source.pluginName || source.scope}`}
					marginLeft={2}
				>
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

	// Sort hook types in logical order
	const eventOrder = [
		"SessionStart",
		"UserPromptSubmit",
		"PreToolUse",
		"PostToolUse",
		"Stop",
		"SubagentStart",
		"SubagentStop",
	];
	const sortedTypes = Array.from(byType.keys()).sort((a, b) => {
		const aIdx = eventOrder.indexOf(a);
		const bIdx = eventOrder.indexOf(b);
		if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
		if (aIdx === -1) return 1;
		if (bIdx === -1) return -1;
		return aIdx - bIdx;
	});

	// Calculate summary
	const totalPlugins = new Set(hooks.map((h) => h.pluginName).filter(Boolean))
		.size;
	const totalHooks = hooks.reduce((sum, h) => sum + h.hooks.length, 0);
	const withCaching = hooks
		.flatMap((h) => h.hooks)
		.filter((h) => h.ifChanged && h.ifChanged.length > 0).length;
	const withDirs = hooks
		.flatMap((h) => h.hooks)
		.filter((h) => h.dirsWith && h.dirsWith.length > 0).length;

	return (
		<Box flexDirection="column" padding={1}>
			{/* Header */}
			<Box flexDirection="column">
				<Text color="cyan" bold>
					{"═".repeat(60)}
				</Text>
				<Text color="white" bold>
					ORCHESTRATOR-MANAGED HOOKS{" "}
					{showAll ? "(all sources)" : "(Han plugins only)"}
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
						<Text dimColor>Total plugins: </Text>
						<Text bold>{totalPlugins}</Text>
					</Box>
					<Box>
						<Text dimColor>Total hooks: </Text>
						<Text color="blue" bold>
							{totalHooks}
						</Text>
					</Box>
					<Box>
						<Text dimColor>With caching (if_changed): </Text>
						<Text color="green" bold>
							{withCaching}
						</Text>
					</Box>
					<Box>
						<Text dimColor>With directory targeting (dirs_with): </Text>
						<Text color="yellow" bold>
							{withDirs}
						</Text>
					</Box>
					<Box>
						<Text dimColor>Event types: </Text>
						<Text>{sortedTypes.join(", ") || "none"}</Text>
					</Box>
				</Box>
			</Box>

			{/* Notes */}
			<Box flexDirection="column" marginTop={1}>
				<Text color="yellow" bold>
					HOW IT WORKS:
				</Text>
				<Box marginLeft={2} flexDirection="column">
					<Text dimColor>
						• All hooks are managed by the central orchestrator (han hook
						orchestrate)
					</Text>
					<Text dimColor>
						• Hooks are discovered from han-plugin.yml files in installed
						plugins
					</Text>
					<Text dimColor>
						• Dependencies are resolved and hooks run in parallel batches
					</Text>
					<Text dimColor>
						• Caching skips hooks when if_changed files haven't been modified
					</Text>
				</Box>
			</Box>
		</Box>
	);
};
