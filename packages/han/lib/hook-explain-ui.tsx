import { Box, Text } from "ink";
import type React from "react";
import type { SettingsScope } from "./config/claude-settings.ts";
import type { HookDependency } from "./hooks/hook-config.ts";

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
	/** Matcher pattern for PreToolUse/PostToolUse hooks */
	matcher?: string;
}

export interface HookSource {
	source: string;
	scope?: SettingsScope;
	pluginName?: string;
	marketplace?: string;
	hookType: string;
	hooks: HookEntry[];
	/** True if this is from a Claude Code plugin's hooks.json (not Han plugin) */
	isClaudePlugin?: boolean;
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

/**
 * Helper to sort hook types in logical order
 */
function sortHookTypes(types: string[]): string[] {
	const eventOrder = [
		"SessionStart",
		"UserPromptSubmit",
		"PreToolUse",
		"PostToolUse",
		"Stop",
		"SubagentStart",
		"SubagentStop",
	];
	return types.sort((a, b) => {
		const aIdx = eventOrder.indexOf(a);
		const bIdx = eventOrder.indexOf(b);
		if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
		if (aIdx === -1) return 1;
		if (bIdx === -1) return -1;
		return aIdx - bIdx;
	});
}

/**
 * Check if a hook source is from Claude Code (plugin or settings)
 */
function isClaudeCodeHook(source: HookSource): boolean {
	return source.isClaudePlugin === true || source.scope !== undefined;
}

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
						Run without --han-only to include Claude Code settings and plugin
						hooks.
					</Text>
				)}
			</Box>
		);
	}

	// Separate Claude Code hooks from Han plugin hooks
	const claudeHooks = hooks.filter(isClaudeCodeHook);
	const hanHooks = hooks.filter((h) => !isClaudeCodeHook(h));

	// Group each by hook type
	const groupByType = (sources: HookSource[]): Map<string, HookSource[]> => {
		const byType = new Map<string, HookSource[]>();
		for (const hook of sources) {
			const existing = byType.get(hook.hookType) || [];
			existing.push(hook);
			byType.set(hook.hookType, existing);
		}
		return byType;
	};

	const claudeByType = groupByType(claudeHooks);
	const hanByType = groupByType(hanHooks);

	const claudeTypes = sortHookTypes(Array.from(claudeByType.keys()));
	const hanTypes = sortHookTypes(Array.from(hanByType.keys()));

	// Calculate summary
	const totalHooks = hooks.reduce((sum, h) => sum + h.hooks.length, 0);
	const claudeHookCount = claudeHooks.reduce(
		(sum, h) => sum + h.hooks.length,
		0,
	);
	const hanHookCount = hanHooks.reduce((sum, h) => sum + h.hooks.length, 0);
	const withCaching = hooks
		.flatMap((h) => h.hooks)
		.filter((h) => h.ifChanged && h.ifChanged.length > 0).length;
	const withDirs = hooks
		.flatMap((h) => h.hooks)
		.filter((h) => h.dirsWith && h.dirsWith.length > 0).length;

	return (
		<Box flexDirection="column" padding={1}>
			{/* Claude Code Hooks Section */}
			{claudeHooks.length > 0 && (
				<Box flexDirection="column">
					<Box flexDirection="column">
						<Text color="magenta" bold>
							{"═".repeat(60)}
						</Text>
						<Text color="white" bold>
							CLAUDE CODE HOOKS ({claudeHookCount} hook
							{claudeHookCount !== 1 ? "s" : ""})
						</Text>
						<Text dimColor>
							Executed directly by Claude Code's hook system
						</Text>
						<Text color="magenta" bold>
							{"═".repeat(60)}
						</Text>
					</Box>

					{claudeTypes.map((type) => {
						const sources = claudeByType.get(type);
						if (!sources) return null;
						return (
							<HookTypeSection key={type} hookType={type} sources={sources} />
						);
					})}
				</Box>
			)}

			{/* Han Plugin Hooks Section */}
			{hanHooks.length > 0 && (
				<Box flexDirection="column" marginTop={claudeHooks.length > 0 ? 2 : 0}>
					<Box flexDirection="column">
						<Text color="cyan" bold>
							{"═".repeat(60)}
						</Text>
						<Text color="white" bold>
							HAN PLUGIN HOOKS ({hanHookCount} hook
							{hanHookCount !== 1 ? "s" : ""})
						</Text>
						<Text dimColor>
							Orchestrated by han hook orchestrate with caching and dependencies
						</Text>
						<Text color="cyan" bold>
							{"═".repeat(60)}
						</Text>
					</Box>

					{hanTypes.map((type) => {
						const sources = hanByType.get(type);
						if (!sources) return null;
						return (
							<HookTypeSection key={type} hookType={type} sources={sources} />
						);
					})}
				</Box>
			)}

			{/* Summary */}
			<Box flexDirection="column" marginTop={2}>
				<Text color="yellow" bold>
					{"─".repeat(60)}
				</Text>
				<Text color="white" bold>
					SUMMARY
				</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text dimColor>Claude Code hooks: </Text>
						<Text color="magenta" bold>
							{claudeHookCount}
						</Text>
					</Box>
					<Box>
						<Text dimColor>Han plugin hooks: </Text>
						<Text color="cyan" bold>
							{hanHookCount}
						</Text>
					</Box>
					<Box>
						<Text dimColor>Total hooks: </Text>
						<Text bold>{totalHooks}</Text>
					</Box>
					{withCaching > 0 && (
						<Box>
							<Text dimColor>With caching (if_changed): </Text>
							<Text color="green" bold>
								{withCaching}
							</Text>
						</Box>
					)}
					{withDirs > 0 && (
						<Box>
							<Text dimColor>With directory targeting (dirs_with): </Text>
							<Text color="yellow" bold>
								{withDirs}
							</Text>
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
};
