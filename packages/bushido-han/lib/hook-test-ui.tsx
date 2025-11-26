import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";

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
		const total = pluginResults.length;
		return { passed, total, allComplete: total > 0, results: pluginResults };
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
								([plugin, hooks], pluginIndex) => {
									const { passed, total, allComplete, results } =
										getPluginResults(hookType, plugin);
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
														({passed}/{hooks.length})
													</Text>
												)}
												{pluginStatus === "pending" && (
													<Text dimColor> (0/{hooks.length})</Text>
												)}
											</Box>

											{/* Command lines under plugin */}
											{hooks.map((hook, cmdIndex) => {
												const isLastCmd = cmdIndex === hooks.length - 1;
												const result = results.find(
													(r) => r.command === hook.command,
												);
												const cmdStatus = result
													? result.success
														? "completed"
														: "failed"
													: pluginStatus === "pending"
														? "pending"
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
														{cmdStatus === "failed" && (
															<Text color="red">✗ </Text>
														)}
														{cmdStatus === "running" && (
															<Text color="yellow">
																<Spinner type="dots" />{" "}
															</Text>
														)}
														{cmdStatus === "pending" && (
															<Text dimColor>○ </Text>
														)}
														<Text
															dimColor={cmdStatus === "pending"}
															color={
																cmdStatus === "running" ? "yellow" : undefined
															}
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
