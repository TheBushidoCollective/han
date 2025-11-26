import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";

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
}

export const HookTestUI: React.FC<HookTestUIProps> = ({
	hookTypes,
	hookStructure,
	hookResults,
	currentType,
	isComplete,
	verbose,
}) => {
	const { write } = useStdout();
	const writtenHookTypes = useRef<Set<string>>(new Set());

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
		// Get expected count from hook structure
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
			// Only completed when all expected hooks have results
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

	// Write completed hook types to stdout (above Ink's rendering area)
	useEffect(() => {
		for (const hookType of hookTypes) {
			const status = getHookTypeStatus(hookType);
			if (
				(status === "completed" || status === "failed") &&
				!writtenHookTypes.current.has(hookType)
			) {
				writtenHookTypes.current.add(hookType);
				const results = hookResults.get(hookType) || [];
				const totalPassed = results.filter((r) => r.success).length;
				const totalCount = results.length;
				const isLast =
					hookTypes.indexOf(hookType) === hookTypes.length - 1 && isComplete;

				const prefix = isLast ? "└─ " : "├─ ";
				const icon = status === "completed" ? "✓" : "✗";
				const color = status === "completed" ? "\x1b[32m" : "\x1b[31m";
				const reset = "\x1b[0m";

				write(
					`${prefix}${color}${icon} ${hookType} (${totalPassed}/${totalCount})${reset}\n`,
				);
			}
		}
	}, [hookTypes, hookResults, isComplete, write, getHookTypeStatus]);

	// Get active (running/pending) hook types for dynamic rendering
	const activeHookTypes = hookTypes.filter((ht) => {
		const status = getHookTypeStatus(ht);
		return status === "running" || status === "pending";
	});

	// Helper to render the currently running hook type (expanded view)
	const renderRunningHookType = (hookType: string, hookTypeIndex: number) => {
		const status = getHookTypeStatus(hookType);
		const pluginHooks = getPluginHooks(hookType);
		const results = hookResults.get(hookType) || [];
		const totalPassed = results.filter((r) => r.success).length;
		const totalHooks = hookStructure.get(hookType)?.length || 0;
		const isLast = hookTypeIndex === activeHookTypes.length - 1;

		return (
			<Box key={hookType} flexDirection="column">
				{/* Hook type line */}
				<Box>
					<Text dimColor>{isLast ? "└─ " : "├─ "}</Text>
					{status === "running" && (
						<Text color="yellow">
							<Spinner type="dots" />{" "}
						</Text>
					)}
					{status === "pending" && <Text dimColor>○ </Text>}
					<Text
						bold={status === "running"}
						color={status === "running" ? "yellow" : undefined}
						dimColor={status === "pending"}
					>
						{hookType}
					</Text>
					{status === "running" && (
						<Text dimColor>
							{" "}
							({totalPassed}/{totalHooks})
						</Text>
					)}
					{status === "pending" && <Text dimColor> (0/{totalHooks})</Text>}
				</Box>

				{/* Only show plugin details for running hook type */}
				{status === "running" &&
					Array.from(pluginHooks.entries()).map(
						([plugin, hooks], pluginIndex) => {
							const {
								passed,
								total,
								allComplete,
								hasFailed,
								results: pluginResults,
							} = getPluginResults(hookType, plugin);
							const isLastPlugin = pluginIndex === pluginHooks.size - 1;
							const pluginStatus = allComplete
								? hasFailed
									? "failed"
									: "completed"
								: "running";

							return (
								<Box key={`${hookType}-${plugin}`} flexDirection="column">
									{/* Plugin name line */}
									<Box>
										<Text dimColor>
											{isLast ? "  " : "│ "}
											{isLastPlugin ? "└─" : "├─"}{" "}
										</Text>
										{pluginStatus === "completed" && (
											<Text color="green">✓ </Text>
										)}
										{pluginStatus === "failed" && <Text color="red">✗ </Text>}
										{pluginStatus === "running" && (
											<Text color="yellow">
												<Spinner type="dots" />{" "}
											</Text>
										)}
										<Text
											color={
												pluginStatus === "running"
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
									</Box>

									{/* Command lines under plugin */}
									{hooks.map((hook, cmdIndex) => {
										const isLastCmd = cmdIndex === hooks.length - 1;
										const result = pluginResults.find(
											(r) => r.command === hook.command,
										);
										const cmdStatus = result
											? result.success
												? "completed"
												: "failed"
											: "running";

										return (
											<Box
												key={`${hookType}-${plugin}-${cmdIndex}-${hook.command.slice(0, 20)}`}
											>
												<Text dimColor>
													{isLast ? "  " : "│ "}
													{isLastPlugin ? "  " : "│ "}
													{isLastCmd ? "└─" : "├─"}{" "}
												</Text>
												{cmdStatus === "completed" && (
													<Text color="green">✓ </Text>
												)}
												{cmdStatus === "failed" && <Text color="red">✗ </Text>}
												{cmdStatus === "running" && (
													<Text color="yellow">
														<Spinner type="dots" />{" "}
													</Text>
												)}
												<Text
													color={cmdStatus === "running" ? "yellow" : undefined}
												>
													{hook.type === "prompt" && "[prompt] "}
													{hook.command}
												</Text>
												{result?.timedOut && (
													<Text color="red"> (timeout)</Text>
												)}
											</Box>
										);
									})}
								</Box>
							);
						},
					)}
			</Box>
		);
	};

	// Check if we should show the header (only before any output is written)
	const showHeader = writtenHookTypes.current.size === 0;

	return (
		<Box flexDirection="column">
			{/* Header - only shown initially */}
			{showHeader && (
				<Box marginBottom={1}>
					<Text bold color="cyan">
						🔍 Testing and executing hooks for installed plugins
					</Text>
				</Box>
			)}

			{/* Active/pending hook types - dynamically re-rendered */}
			{activeHookTypes.length > 0 && (
				<Box flexDirection="column">
					{activeHookTypes.map((hookType, index) =>
						renderRunningHookType(hookType, index),
					)}
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
												{result.output.map((line, i) => (
													<Text
														key={`failed-${hookType}-${result.plugin}-${idx}-line-${i}`}
													>
														{line}
													</Text>
												))}
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
