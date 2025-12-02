import { Box, Text, useInput, useStdout } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type LiveOutputState,
	makeLiveOutputKey,
} from "./hook-test.js";

interface HookResult {
	plugin: string;
	command: string;
	success: boolean;
	output: string[];
	isPrompt?: boolean;
	timedOut?: boolean;
}

interface HookStructureItem {
	plugin: string;
	command: string;
	pluginDir: string;
	type: "command" | "prompt";
	timeout?: number;
}

interface HookTestUIProps {
	hookTypes: string[];
	hookStructure: Map<string, HookStructureItem[]>;
	hookResults: Map<string, HookResult[]>;
	currentType: string | null;
	isComplete: boolean;
	verbose: boolean;
	liveOutput?: LiveOutputState;
}

type ViewMode = "list" | "detail";

interface FlatItem {
	type: "hookType" | "plugin" | "command";
	hookType: string;
	plugin?: string;
	command?: string;
	commandIndex?: number;
}

export const HookTestUI: React.FC<HookTestUIProps> = ({
	hookTypes,
	hookStructure,
	hookResults,
	currentType,
	isComplete,
	verbose,
	liveOutput,
}) => {
	const { write } = useStdout();
	const writtenHookTypes = useRef<Set<string>>(new Set());
	const lastAutoSelectedType = useRef<string | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [expandedType, setExpandedType] = useState<string | null>(null);
	const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null); // "hookType:plugin" format
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [detailItem, setDetailItem] = useState<FlatItem | null>(null);

	// Build flat list of navigable items based on expansion state
	const getFlatItems = useCallback((): FlatItem[] => {
		const items: FlatItem[] = [];

		for (const hookType of hookTypes) {
			items.push({ type: "hookType", hookType });

			if (expandedType === hookType) {
				const hooks = hookStructure.get(hookType) || [];
				const pluginMap = new Map<string, HookStructureItem[]>();
				for (const hook of hooks) {
					if (!pluginMap.has(hook.plugin)) {
						pluginMap.set(hook.plugin, []);
					}
					pluginMap.get(hook.plugin)?.push(hook);
				}

				for (const [plugin, pluginHooks] of pluginMap) {
					items.push({ type: "plugin", hookType, plugin });
					// Only show commands if this plugin is expanded
					const pluginKey = `${hookType}:${plugin}`;
					if (expandedPlugin === pluginKey) {
						for (let i = 0; i < pluginHooks.length; i++) {
							items.push({
								type: "command",
								hookType,
								plugin,
								command: pluginHooks[i].command,
								commandIndex: i,
							});
						}
					}
				}
			}
		}

		return items;
	}, [hookTypes, hookStructure, expandedType, expandedPlugin]);

	const flatItems = getFlatItems();

	// Group hooks by plugin for each hook type
	const getPluginHooks = (hookType: string) => {
		const hooks = hookStructure.get(hookType) || [];
		const pluginMap = new Map<string, HookStructureItem[]>();
		for (const hook of hooks) {
			if (!pluginMap.has(hook.plugin)) {
				pluginMap.set(hook.plugin, []);
			}
			pluginMap.get(hook.plugin)?.push(hook);
		}
		return pluginMap;
	};

	// Get results for a specific plugin within a hook type
	const getPluginResults = (hookType: string, plugin: string) => {
		const results = hookResults.get(hookType) || [];
		const pluginResults = results.filter((r) => r.plugin === plugin);
		const passed = pluginResults.filter((r) => r.success).length;
		const failed = pluginResults.filter((r) => !r.success).length;
		const total = pluginResults.length;
		const expectedHooks = hookStructure.get(hookType) || [];
		const expectedForPlugin = expectedHooks.filter(
			(h) => h.plugin === plugin,
		).length;
		const allComplete = total >= expectedForPlugin;
		const hasFailed = failed > 0;
		return {
			passed,
			failed,
			total,
			allComplete,
			hasFailed,
			results: pluginResults,
		};
	};

	// Determine status for each hook type
	const getHookTypeStatus = useCallback(
		(hookType: string) => {
			const results = hookResults.get(hookType) || [];
			const expectedHooks = hookStructure.get(hookType) || [];
			const hasFailed = results.some((r) => !r.success);
			if (results.length >= expectedHooks.length && expectedHooks.length > 0) {
				return hasFailed ? "failed" : "completed";
			}
			if (hookType === currentType) {
				return "running";
			}
			return "pending";
		},
		[hookResults, hookStructure, currentType],
	);

	// Get result for a specific command
	const getCommandResult = (
		hookType: string,
		plugin: string,
		command: string,
	): HookResult | undefined => {
		const results = hookResults.get(hookType) || [];
		return results.find((r) => r.plugin === plugin && r.command === command);
	};

	// Handle keyboard input
	useInput((input, key) => {
		if (viewMode === "detail") {
			// In detail view, Esc goes back to list
			if (key.escape) {
				setViewMode("list");
				setDetailItem(null);
			}
			return;
		}

		// List mode navigation
		if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
		} else if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(flatItems.length - 1, prev + 1));
		} else if (key.return || input === " ") {
			const item = flatItems[selectedIndex];
			if (!item) return;

			if (item.type === "hookType") {
				// Toggle expansion (accordion - only one open at a time)
				if (expandedType === item.hookType) {
					setExpandedType(null);
					setExpandedPlugin(null);
				} else {
					setExpandedType(item.hookType);
					setExpandedPlugin(null);
				}
			} else if (item.type === "plugin" && item.plugin) {
				// Toggle plugin expansion
				const pluginKey = `${item.hookType}:${item.plugin}`;
				if (expandedPlugin === pluginKey) {
					setExpandedPlugin(null);
				} else {
					setExpandedPlugin(pluginKey);
				}
			} else if (item.type === "command" && item.plugin && item.command) {
				// View command output
				setDetailItem(item);
				setViewMode("detail");
			}
		} else if (key.escape) {
			// Collapse in order: plugin first, then hook type
			if (expandedPlugin) {
				// Find the plugin row and select it
				const pluginIndex = flatItems.findIndex(
					(i) =>
						i.type === "plugin" &&
						`${i.hookType}:${i.plugin}` === expandedPlugin,
				);
				if (pluginIndex !== -1) {
					setSelectedIndex(pluginIndex);
				}
				setExpandedPlugin(null);
			} else if (expandedType) {
				// Find the index of the expanded type and select it
				const typeIndex = flatItems.findIndex(
					(i) => i.type === "hookType" && i.hookType === expandedType,
				);
				if (typeIndex !== -1) {
					setSelectedIndex(typeIndex);
				}
				setExpandedType(null);
			}
		}
	});

	// Auto-expand and select running hook type (only when it changes)
	useEffect(() => {
		if (
			currentType &&
			!isComplete &&
			currentType !== lastAutoSelectedType.current
		) {
			lastAutoSelectedType.current = currentType;
			setExpandedType(currentType);
			const idx = hookTypes.indexOf(currentType);
			if (idx !== -1) {
				setSelectedIndex(idx);
			}
		}
	}, [currentType, isComplete, hookTypes]);

	// Write completion summary to stdout when done
	useEffect(() => {
		if (isComplete) {
			for (const hookType of hookTypes) {
				if (!writtenHookTypes.current.has(hookType)) {
					writtenHookTypes.current.add(hookType);
					const status = getHookTypeStatus(hookType);
					const results = hookResults.get(hookType) || [];
					const totalPassed = results.filter((r) => r.success).length;
					const totalCount = results.length;
					const isLast = hookTypes.indexOf(hookType) === hookTypes.length - 1;

					const prefix = isLast ? "└─ " : "├─ ";
					const icon = status === "completed" ? "✓" : "✗";
					const color = status === "completed" ? "\x1b[32m" : "\x1b[31m";
					const reset = "\x1b[0m";

					write(
						`${prefix}${color}${icon} ${hookType} (${totalPassed}/${totalCount})${reset}\n`,
					);
				}
			}
		}
	}, [isComplete, hookTypes, hookResults, write, getHookTypeStatus]);

	// Get live output for a command that's still running
	const getLiveOutput = (
		hookType: string,
		plugin: string,
		command: string,
	): string[] => {
		if (!liveOutput) return [];
		const key = makeLiveOutputKey(hookType, plugin, command);
		return liveOutput.outputs.get(key) || [];
	};

	// Render detail view for a command
	const renderDetailView = () => {
		if (!detailItem || !detailItem.plugin || !detailItem.command) return null;

		const result = getCommandResult(
			detailItem.hookType,
			detailItem.plugin,
			detailItem.command,
		);
		const status = result
			? result.success
				? "completed"
				: "failed"
			: "running";

		// Get output - use result output if complete, otherwise use live output
		const outputLines =
			result?.output && result.output.length > 0
				? result.output
				: getLiveOutput(
						detailItem.hookType,
						detailItem.plugin,
						detailItem.command,
					);

		return (
			<Box flexDirection="column">
				{/* Header */}
				<Box marginBottom={1}>
					<Text bold color="cyan">
						📋 Command Output
					</Text>
					<Text dimColor> (Esc to go back)</Text>
				</Box>

				{/* Command info */}
				<Box flexDirection="column" marginBottom={1}>
					<Box>
						<Text dimColor>Hook Type: </Text>
						<Text bold>{detailItem.hookType}</Text>
					</Box>
					<Box>
						<Text dimColor>Plugin: </Text>
						<Text bold>{detailItem.plugin}</Text>
					</Box>
					<Box>
						<Text dimColor>Command: </Text>
						<Text>{detailItem.command}</Text>
					</Box>
					<Box>
						<Text dimColor>Status: </Text>
						{status === "completed" && (
							<Text color="green" bold>
								✓ Passed
							</Text>
						)}
						{status === "failed" && (
							<Text color="red" bold>
								✗ Failed
							</Text>
						)}
						{status === "running" && (
							<Text color="yellow">
								<Spinner type="dots" /> Running...
							</Text>
						)}
						{result?.timedOut && <Text color="red"> (timeout)</Text>}
					</Box>
				</Box>

				{/* Output */}
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>{"─".repeat(60)}</Text>
					{outputLines.length > 0 ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: output lines have no unique identifier
						outputLines.map((line, i) => <Text key={i}>{line}</Text>)
					) : status === "running" ? (
						<Text dimColor>Waiting for output...</Text>
					) : (
						<Text dimColor>No output</Text>
					)}
				</Box>
			</Box>
		);
	};

	// Render list item based on type
	const renderListItem = (item: FlatItem, index: number) => {
		const isSelected = index === selectedIndex;

		if (item.type === "hookType") {
			return renderHookTypeRow(item.hookType, isSelected);
		}
		if (item.type === "plugin" && item.plugin) {
			return renderPluginRow(item.hookType, item.plugin, isSelected);
		}
		if (item.type === "command" && item.plugin && item.command !== undefined) {
			return renderCommandRow(
				item.hookType,
				item.plugin,
				item.command,
				item.commandIndex ?? 0,
				isSelected,
			);
		}
		return null;
	};

	// Render a hook type row
	const renderHookTypeRow = (hookType: string, isSelected: boolean) => {
		const status = getHookTypeStatus(hookType);
		const results = hookResults.get(hookType) || [];
		const totalPassed = results.filter((r) => r.success).length;
		const totalHooks = hookStructure.get(hookType)?.length || 0;
		const totalCount = results.length;
		const isExpanded = expandedType === hookType;
		const isLast = hookTypes.indexOf(hookType) === hookTypes.length - 1;

		return (
			<Box key={`type-${hookType}`}>
				<Text dimColor>{isLast && !isExpanded ? "└─ " : "├─ "}</Text>
				{isSelected && <Text color="cyan">▸ </Text>}
				{!isSelected && <Text> </Text>}
				{status === "completed" && (
					<Text color="green" bold>
						✓{" "}
					</Text>
				)}
				{status === "failed" && (
					<Text color="red" bold>
						✗{" "}
					</Text>
				)}
				{status === "running" && (
					<Text color="yellow">
						<Spinner type="dots" />{" "}
					</Text>
				)}
				{status === "pending" && <Text dimColor>○ </Text>}
				<Text
					bold={isSelected || status === "running"}
					color={
						status === "running"
							? "yellow"
							: status === "failed"
								? "red"
								: isSelected
									? "cyan"
									: undefined
					}
					dimColor={status === "pending" && !isSelected}
				>
					{hookType}
				</Text>
				{status === "completed" && (
					<Text color="green">
						{" "}
						({totalPassed}/{totalCount})
					</Text>
				)}
				{status === "failed" && (
					<Text color="red">
						{" "}
						({totalPassed}/{totalCount})
					</Text>
				)}
				{status === "running" && (
					<Text dimColor>
						{" "}
						({totalPassed}/{totalHooks})
					</Text>
				)}
				{status === "pending" && <Text dimColor> (0/{totalHooks})</Text>}
				<Text dimColor> {isExpanded ? "▾" : "▸"}</Text>
			</Box>
		);
	};

	// Render a plugin row
	const renderPluginRow = (
		hookType: string,
		plugin: string,
		isSelected: boolean,
	) => {
		const status = getHookTypeStatus(hookType);
		const pluginHooks = getPluginHooks(hookType);
		const { passed, total, allComplete, hasFailed } = getPluginResults(
			hookType,
			plugin,
		);
		const hooks = pluginHooks.get(plugin) || [];
		const pluginStatus =
			status === "pending"
				? "pending"
				: allComplete
					? hasFailed
						? "failed"
						: "completed"
					: "running";

		const pluginArray = Array.from(pluginHooks.keys());
		const isLastPlugin = pluginArray.indexOf(plugin) === pluginArray.length - 1;
		const isLastType = hookTypes.indexOf(hookType) === hookTypes.length - 1;
		const pluginKey = `${hookType}:${plugin}`;
		const isPluginExpanded = expandedPlugin === pluginKey;

		return (
			<Box key={`plugin-${hookType}-${plugin}`}>
				<Text dimColor>
					{isLastType ? "  " : "│ "}
					{"  "}
					{isLastPlugin && !isPluginExpanded ? "└─" : "├─"}{" "}
				</Text>
				{isSelected && <Text color="cyan">▸ </Text>}
				{!isSelected && <Text> </Text>}
				{pluginStatus === "completed" && <Text color="green">✓ </Text>}
				{pluginStatus === "failed" && <Text color="red">✗ </Text>}
				{pluginStatus === "running" && (
					<Text color="yellow">
						<Spinner type="dots" />{" "}
					</Text>
				)}
				{pluginStatus === "pending" && <Text dimColor>○ </Text>}
				<Text
					dimColor={pluginStatus === "pending" && !isSelected}
					bold={isSelected}
					color={
						isSelected
							? "cyan"
							: pluginStatus === "running"
								? "yellow"
								: pluginStatus === "failed"
									? "red"
									: undefined
					}
				>
					{plugin}
				</Text>
				{pluginStatus === "completed" && (
					<Text color="green">
						{" "}
						({passed}/{total})
					</Text>
				)}
				{pluginStatus === "failed" && (
					<Text color="red">
						{" "}
						({passed}/{total})
					</Text>
				)}
				{pluginStatus === "running" && (
					<Text dimColor>
						{" "}
						({passed}/{hooks.length})
					</Text>
				)}
				{pluginStatus === "pending" && (
					<Text dimColor> (0/{hooks.length})</Text>
				)}
				<Text dimColor> {isPluginExpanded ? "▾" : "▸"}</Text>
			</Box>
		);
	};

	// Render a command row
	const renderCommandRow = (
		hookType: string,
		plugin: string,
		command: string,
		cmdIndex: number,
		isSelected: boolean,
	) => {
		const status = getHookTypeStatus(hookType);
		const { results: pluginResults } = getPluginResults(hookType, plugin);
		const pluginHooks = getPluginHooks(hookType);
		const hooks = pluginHooks.get(plugin) || [];
		const hook = hooks[cmdIndex];
		const result = pluginResults.find((r) => r.command === command);
		const cmdStatus = result
			? result.success
				? "completed"
				: "failed"
			: status === "pending"
				? "pending"
				: "running";

		const pluginArray = Array.from(pluginHooks.keys());
		const isLastPlugin = pluginArray.indexOf(plugin) === pluginArray.length - 1;
		const isLastCmd = cmdIndex === hooks.length - 1;
		const isLastType = hookTypes.indexOf(hookType) === hookTypes.length - 1;

		return (
			<Box key={`cmd-${hookType}-${plugin}-${cmdIndex}`}>
				<Text dimColor>
					{isLastType ? "  " : "│ "}
					{"  "}
					{isLastPlugin ? "  " : "│ "}
					{"  "}
					{isLastCmd ? "└─" : "├─"}{" "}
				</Text>
				{isSelected && <Text color="cyan">▸ </Text>}
				{!isSelected && <Text> </Text>}
				{cmdStatus === "completed" && <Text color="green">✓ </Text>}
				{cmdStatus === "failed" && <Text color="red">✗ </Text>}
				{cmdStatus === "running" && (
					<Text color="yellow">
						<Spinner type="dots" />{" "}
					</Text>
				)}
				{cmdStatus === "pending" && <Text dimColor>○ </Text>}
				<Text
					dimColor={cmdStatus === "pending" && !isSelected}
					bold={isSelected}
					color={
						isSelected ? "cyan" : cmdStatus === "running" ? "yellow" : undefined
					}
				>
					{hook?.type === "prompt" ? "[prompt]" : command}
				</Text>
				{result?.timedOut && <Text color="red"> (timeout)</Text>}
				{isSelected &&
					(cmdStatus === "completed" || cmdStatus === "failed") && (
						<Text dimColor> (Enter to view output)</Text>
					)}
			</Box>
		);
	};

	// Detail view
	if (viewMode === "detail") {
		return renderDetailView();
	}

	// List view
	return (
		<Box flexDirection="column">
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🔍 Hook Test
				</Text>
				{!isComplete && (
					<Text dimColor> (↑↓ navigate, Enter expand/view, Esc collapse)</Text>
				)}
			</Box>

			{/* Hook types list */}
			{!isComplete && (
				<Box flexDirection="column">
					{flatItems.map((item, index) => renderListItem(item, index))}
				</Box>
			)}

			{/* Completion message */}
			{isComplete && (
				<Box marginTop={1} flexDirection="column">
					<Box marginBottom={1}>
						<Text dimColor>{"=".repeat(60)}</Text>
					</Box>
					<Box>
						{Array.from(hookResults.values()).some((results) =>
							results.some((r) => !r.success),
						) ? (
							<Text bold color="red">
								❌ Some hooks failed execution
							</Text>
						) : (
							<Text bold color="green">
								✅ All hooks executed successfully
							</Text>
						)}
					</Box>

					{/* Show failed hook output */}
					{Array.from(hookResults.entries()).map(([hookType, results]) => {
						const failedResults = results.filter((r) => !r.success);
						if (failedResults.length === 0) return null;

						return (
							<Box
								key={`failed-${hookType}`}
								flexDirection="column"
								marginTop={1}
							>
								<Text bold color="red">
									Failed hooks in {hookType}:
								</Text>
								{failedResults.map((result, idx) => (
									<Box
										key={`failed-${hookType}-${result.plugin}-${idx}`}
										flexDirection="column"
										marginLeft={2}
										marginTop={1}
									>
										<Box>
											<Text color="red">✗ </Text>
											<Text bold>
												{result.plugin}: {result.command}
											</Text>
											{result.timedOut && <Text color="red"> (timeout)</Text>}
										</Box>
										{result.output.length > 0 && (
											<Box flexDirection="column" marginLeft={2} marginTop={1}>
												{result.output.slice(0, 10).map((line, i) => (
													<Text
														key={`failed-${hookType}-${result.plugin}-${idx}-line-${i}`}
													>
														{line}
													</Text>
												))}
												{result.output.length > 10 && (
													<Text dimColor>
														... and {result.output.length - 10} more lines
													</Text>
												)}
											</Box>
										)}
									</Box>
								))}
							</Box>
						);
					})}
				</Box>
			)}

			{/* Verbose output */}
			{verbose && isComplete && (
				<Box flexDirection="column" marginTop={1}>
					{Array.from(hookResults.entries()).map(([hookType, results]) => (
						<Box key={hookType} flexDirection="column" marginBottom={1}>
							<Text bold color="cyan">
								{hookType}:
							</Text>
							{results.map((result, idx) => (
								<Box
									key={`${hookType}-${result.plugin}-${idx}`}
									flexDirection="column"
									marginLeft={2}
								>
									<Box>
										{result.success ? (
											<Text color="green">✓ </Text>
										) : (
											<Text color="red">✗ </Text>
										)}
										<Text>{result.plugin}</Text>
									</Box>
									{result.output.length > 0 && (
										<Box flexDirection="column" marginLeft={2}>
											{result.output.map((line, i) => (
												<Text
													key={`${hookType}-${result.plugin}-${idx}-line-${i}`}
													dimColor
												>
													{line}
												</Text>
											))}
										</Box>
									)}
								</Box>
							))}
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
};
