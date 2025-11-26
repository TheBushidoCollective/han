import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";

interface HookResult {
	plugin: string;
	success: boolean;
	output: string[];
}

interface HookTestUIProps {
	hookTypes: string[];
	hookResults: Map<string, HookResult[]>;
	currentType: string | null;
	isComplete: boolean;
	verbose: boolean;
}

export const HookTestUI: React.FC<HookTestUIProps> = ({
	hookTypes,
	hookResults,
	currentType,
	isComplete,
	verbose,
}) => {
	const expanded = verbose;

	return (
		<Box flexDirection="column" paddingY={1}>
			{/* Header */}
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🔍 Testing and executing hooks for installed plugins
				</Text>
			</Box>

			{/* Current progress */}
			{!isComplete && currentType && (
				<Box marginBottom={1}>
					<Text color="green">
						<Spinner type="dots" />
					</Text>
					<Text> Processing: </Text>
					<Text bold color="yellow">
						{currentType}
					</Text>
					<Text> hooks...</Text>
				</Box>
			)}

			{/* Results summary */}
			<Box flexDirection="column" marginTop={1}>
				{Array.from(hookResults.entries()).map(([hookType, results]) => {
					const passed = results.filter((r) => r.success).length;
					const total = results.length;
					const failed = total - passed;

					// Group results by plugin
					const pluginResults = new Map<
						string,
						{ passed: number; total: number }
					>();
					for (const result of results) {
						const current = pluginResults.get(result.plugin) || {
							passed: 0,
							total: 0,
						};
						pluginResults.set(result.plugin, {
							passed: current.passed + (result.success ? 1 : 0),
							total: current.total + 1,
						});
					}

					return (
						<Box key={hookType} flexDirection="column" marginBottom={1}>
							<Box>
								<Text>
									{" "}
									{failed === 0 ? (
										<Text color="green" bold>
											✓
										</Text>
									) : (
										<Text color="red" bold>
											✗
										</Text>
									)}{" "}
									<Text bold>{hookType}</Text>
									<Text dimColor>
										: {passed}/{total} passed
									</Text>
								</Text>
							</Box>

							{/* Plugin breakdown */}
							{!expanded &&
								Array.from(pluginResults.entries()).map(([plugin, stats]) => (
									<Box key={`${hookType}-${plugin}`} marginLeft={2}>
										<Text dimColor>
											- {plugin}@han: {stats.passed}/{stats.total} passed
										</Text>
									</Box>
								))}

							{/* Expanded view with detailed output */}
							{expanded && (
								<Box flexDirection="column" marginLeft={2}>
									{results.map((result, idx) => (
										<Box
											key={`${hookType}-${result.plugin}-${idx}`}
											flexDirection="column"
											marginTop={1}
										>
											<Box>
												{result.success ? (
													<Text color="green">✓ </Text>
												) : (
													<Text color="red">✗ </Text>
												)}
												<Text bold color="cyan">
													{result.plugin}
												</Text>
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
							)}
						</Box>
					);
				})}
			</Box>

			{/* Footer with completion message */}

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
		</Box>
	);
};
