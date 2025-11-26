import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";

interface HookResult {
	plugin: string;
	success: boolean;
	output: string[];
}

interface HookStructureItem {
	plugin: string;
	command: string;
	pluginDir: string;
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
	// Group hooks by plugin for each hook type
	const getPluginHooks = (hookType: string) => {
		const hooks = hookStructure.get(hookType) || [];
		const pluginMap = new Map<string, number>();
		for (const hook of hooks) {
			pluginMap.set(hook.plugin, (pluginMap.get(hook.plugin) || 0) + 1);
		}
		return pluginMap;
	};

	// Get results for a specific plugin within a hook type
	const getPluginResults = (hookType: string, plugin: string) => {
		const results = hookResults.get(hookType) || [];
		const pluginResults = results.filter((r) => r.plugin === plugin);
		const passed = pluginResults.filter((r) => r.success).length;
		const total = pluginResults.length;
		return { passed, total, allComplete: total > 0 };
	};

	// Determine status for each hook type
	const getHookTypeStatus = (hookType: string) => {
		if (hookResults.has(hookType)) {
			return "completed";
		}
		if (hookType === currentType) {
			return "running";
		}
		return "pending";
	};

	return (
		<Box flexDirection="column" paddingY={1}>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🔍 Testing and executing hooks for installed plugins
				</Text>
			</Box>

			{/* Tree structure */}
			<Box flexDirection="column">
				{hookTypes.map((hookType, hookTypeIndex) => {
					const status = getHookTypeStatus(hookType);
					const pluginHooks = getPluginHooks(hookType);
					const results = hookResults.get(hookType) || [];
					const totalPassed = results.filter((r) => r.success).length;
					const totalCount = results.length;
					const totalHooks = hookStructure.get(hookType)?.length || 0;
					const isLast = hookTypeIndex === hookTypes.length - 1;

					return (
						<Box key={hookType} flexDirection="column">
							{/* Hook type line */}
							<Box>
								<Text dimColor>{isLast ? "└─ " : "├─ "}</Text>
								{status === "completed" && (
									<Text color="green" bold>
										✓{" "}
									</Text>
								)}
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
								{status === "completed" && (
									<Text color="green">
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
								{status === "pending" && (
									<Text dimColor> (0/{totalHooks})</Text>
								)}
							</Box>

							{/* Plugin lines */}
							{Array.from(pluginHooks.entries()).map(
								([plugin, count], pluginIndex) => {
									const { passed, total, allComplete } = getPluginResults(
										hookType,
										plugin,
									);
									const isLastPlugin = pluginIndex === pluginHooks.size - 1;
									const pluginStatus =
										status === "pending"
											? "pending"
											: allComplete
												? "completed"
												: status === "running"
													? "running"
													: "pending";

									return (
										<Box key={`${hookType}-${plugin}`} marginLeft={1}>
											<Text dimColor>
												{isLast ? "    " : "│   "}
												{isLastPlugin ? "└─ " : "├─ "}
											</Text>
											{pluginStatus === "completed" && (
												<Text color="green">✓ </Text>
											)}
											{pluginStatus === "running" && (
												<Text color="yellow">
													<Spinner type="dots" />{" "}
												</Text>
											)}
											{pluginStatus === "pending" && <Text dimColor>○ </Text>}
											<Text
												dimColor={pluginStatus === "pending"}
												color={
													pluginStatus === "running" ? "yellow" : undefined
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
											{pluginStatus === "running" && (
												<Text dimColor>
													{" "}
													({passed}/{count})
												</Text>
											)}
											{pluginStatus === "pending" && (
												<Text dimColor> (0/{count})</Text>
											)}
										</Box>
									);
								},
							)}
						</Box>
					);
				})}
			</Box>

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
