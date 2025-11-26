import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";

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
	verbose: initialVerbose,
}) => {
	const [expanded, setExpanded] = useState(initialVerbose);

	// Handle keyboard input for toggling expanded view
	useInput((input, key) => {
		if (key.ctrl && input === "o") {
			setExpanded(!expanded);
		}
	});

	const currentTypeIndex = currentType
		? hookTypes.indexOf(currentType)
		: hookTypes.length;

	return (
		<Box flexDirection="column" paddingY={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🔍 Testing and executing hooks for installed plugins
				</Text>
			</Box>

			{!isComplete && currentType && (
				<Box marginBottom={1}>
					<Text>
						Processing: <Text color="yellow">{currentType}</Text> hooks (
						{currentTypeIndex + 1}/{hookTypes.length})
					</Text>
				</Box>
			)}

			{/* Summary view */}
			{!expanded && (
				<Box flexDirection="column" marginTop={1}>
					{Array.from(hookResults.entries()).map(([hookType, results]) => {
						const passed = results.filter((r) => r.success).length;
						const failed = results.filter((r) => !r.success).length;
						const total = results.length;

						return (
							<Box key={hookType} marginLeft={1}>
								<Text>
									{failed === 0 ? (
										<Text color="green">✓</Text>
									) : (
										<Text color="red">✗</Text>
									)}{" "}
									{hookType}: {passed}/{total} passed
									{failed > 0 && <Text color="red"> ({failed} failed)</Text>}
								</Text>
							</Box>
						);
					})}

					{!isComplete && (
						<Box marginTop={1}>
							<Text dimColor>Press Cmd+O to show detailed output</Text>
						</Box>
					)}
				</Box>
			)}

			{/* Expanded view */}
			{expanded && (
				<Box flexDirection="column" marginTop={1}>
					{Array.from(hookResults.entries()).map(([hookType, results]) => (
						<Box key={hookType} flexDirection="column" marginBottom={1}>
							<Text bold color="cyan">
								📌 {hookType} ({results.length} hooks):
							</Text>
							{results.map((result, idx) => (
								<Box
									key={`${hookType}-${result.plugin}-${idx}`}
									flexDirection="column"
									marginLeft={2}
									marginTop={1}
								>
									<Text>
										{result.success ? (
											<Text color="green">✓</Text>
										) : (
											<Text color="red">✗</Text>
										)}{" "}
										<Text bold>{result.plugin}</Text>
									</Text>
									{result.output.length > 0 && (
										<Box flexDirection="column" marginLeft={2}>
											{result.output.map((line, i) => (
												<Text key={`${hookType}-${result.plugin}-${idx}-${i}`} dimColor>
													{line}
												</Text>
											))}
										</Box>
									)}
								</Box>
							))}
						</Box>
					))}

					{!isComplete && (
						<Box marginTop={1}>
							<Text dimColor>Press Cmd+O to collapse</Text>
						</Box>
					)}
				</Box>
			)}

			{isComplete && (
				<Box marginTop={1} flexDirection="column">
					<Box>
						<Text>{"=".repeat(60)}</Text>
					</Box>
					<Box marginY={1}>
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
