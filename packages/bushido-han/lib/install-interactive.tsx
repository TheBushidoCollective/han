import { Box, Static, Text } from "ink";
import Spinner from "ink-spinner";
import { marked } from "marked";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PluginSelector } from "./plugin-selector.js";
import type {
	AgentUpdate,
	DetectPluginsCallbacks,
	MarketplacePlugin,
} from "./shared.js";

interface InstallInteractiveProps {
	detectPlugins: (callbacks: DetectPluginsCallbacks) => Promise<void>;
	fetchMarketplace: () => Promise<MarketplacePlugin[]>;
	installedPlugins: string[];
	onInstallComplete: (plugins: string[]) => void;
	onInstallError: (error: Error) => void;
	onCancel: () => void;
}

interface LogLine {
	id: string;
	text: string;
	type: "info" | "tool" | "thinking" | "error" | "spacer";
}

/**
 * Format tool usage with details about what's being operated on
 */
function formatToolUsage(
	toolName: string,
	toolInput?: Record<string, unknown>,
): string {
	const name = toolName.toLowerCase();
	const input = toolInput || {};

	// Handle Read/read_file
	if (name === "read" || name === "read_file") {
		const filePath = input.file_path || input.path;
		return filePath ? `📄 Reading: ${filePath}` : "📄 Reading file";
	}

	// Handle Grep/grep
	if (name === "grep") {
		const pattern = input.pattern || input.regex;
		const path = input.path || input.directory;
		if (pattern && path) return `🔍 Grep: "${pattern}" in ${path}`;
		if (pattern) return `🔍 Grep: "${pattern}"`;
		return "🔍 Searching";
	}

	// Handle Glob/glob
	if (name === "glob") {
		const pattern = input.pattern || input.glob;
		const path = input.path || input.directory;
		if (pattern && path) return `📁 Glob: ${pattern} in ${path}`;
		if (pattern) return `📁 Glob: ${pattern}`;
		return "📁 Finding files";
	}

	// Handle Bash/bash
	if (name === "bash") {
		const cmd = input.command || input.cmd;
		if (cmd && typeof cmd === "string") {
			// Truncate long commands
			const truncated = cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
			return `💻 Bash: ${truncated}`;
		}
		return "💻 Running command";
	}

	return `🔧 ${toolName}`;
}

/**
 * Parse markdown to plain text for terminal display
 */
function parseMarkdown(text: string): string {
	try {
		const parsed = marked.parse(text, { async: false });
		if (typeof parsed === "string") {
			// Strip HTML tags and clean up for terminal
			return parsed
				.replace(/<[^>]*>/g, "")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&amp;/g, "&")
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, "'")
				.trim();
		}
		return text;
	} catch {
		return text;
	}
}

export const InstallInteractive: React.FC<InstallInteractiveProps> = ({
	detectPlugins,
	fetchMarketplace,
	installedPlugins,
	onInstallComplete,
	onInstallError,
	onCancel,
}) => {
	const [phase, setPhase] = useState<
		"analyzing" | "analyzed" | "selecting" | "complete" | "error"
	>("analyzing");
	const [detectedPlugins, setDetectedPlugins] = useState<string[]>([]);
	const [allPlugins, setAllPlugins] = useState<MarketplacePlugin[]>([]);
	const [logLines, setLogLines] = useState<LogLine[]>([]);
	const [_currentLine, setCurrentLine] = useState("");
	const [error, setError] = useState<string | null>(null);

	const isMountedRef = useRef(true);
	const lineIdRef = useRef(0);
	const currentLineRef = useRef("");

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// Clear log lines when transitioning to selecting phase
	// This prevents the Static content from remaining in the terminal
	useEffect(() => {
		if (phase === "selecting") {
			setLogLines([]);
		}
	}, [phase]);

	// Add a completed line to the log (with automatic spacer after non-spacer lines)
	const addLogLine = useCallback((text: string, type: LogLine["type"]) => {
		if (!isMountedRef.current) return;
		// Skip empty lines unless spacer
		if (!text.trim() && type !== "spacer") return;

		setLogLines((prev) => {
			const id = `line-${lineIdRef.current++}`;
			const newLines = [...prev, { id, text: text.trim(), type }];
			// Add spacer after every non-spacer line
			if (type !== "spacer") {
				const spacerId = `line-${lineIdRef.current++}`;
				newLines.push({ id: spacerId, text: "", type: "spacer" });
			}
			return newLines;
		});
	}, []);

	// Flush current line to log
	const _flushCurrentLine = useCallback(() => {
		if (currentLineRef.current.trim()) {
			addLogLine(currentLineRef.current, "thinking");
			currentLineRef.current = "";
			setCurrentLine("");
		}
	}, [addLogLine]);

	useEffect(() => {
		let marketplaceLoaded = false;
		let detectionComplete = false;

		// Fetch marketplace plugins
		fetchMarketplace()
			.then((plugins) => {
				if (isMountedRef.current) {
					setAllPlugins(plugins);
					marketplaceLoaded = true;
					// If detection is also complete, move to selection
					if (detectionComplete) {
						moveToSelection();
					}
				}
			})
			.catch((err) => {
				if (isMountedRef.current) {
					setError(`Failed to fetch marketplace: ${err.message}`);
					setPhase("error");
					onInstallError(err);
				}
			});

		const moveToSelection = () => {
			setPhase("analyzed");
			// Move to selection after a brief pause
			setTimeout(() => {
				if (isMountedRef.current) {
					setPhase("selecting");
				}
			}, 1000);
		};

		// Start plugin detection
		const callbacks: DetectPluginsCallbacks = {
			onUpdate: (update: AgentUpdate) => {
				if (!isMountedRef.current) return;

				if (update.type === "text") {
					// Just accumulate text - don't flush until tool or complete
					currentLineRef.current += update.content;
					setCurrentLine(currentLineRef.current);
				} else if (update.type === "tool" && update.toolName) {
					// Flush current line before showing tool
					if (currentLineRef.current.trim()) {
						// Strip trailing colons from agent messages
						const text = currentLineRef.current.trim().replace(/:$/, "");
						addLogLine(`💬 ${parseMarkdown(text)}`, "thinking");
						currentLineRef.current = "";
						setCurrentLine("");
					}
					// Add tool usage as a log line
					addLogLine(
						formatToolUsage(update.toolName, update.toolInput),
						"tool",
					);
				}
			},
			onComplete: (plugins: string[]) => {
				if (!isMountedRef.current) return;

				// Flush any remaining current line
				if (currentLineRef.current.trim()) {
					const text = currentLineRef.current.trim().replace(/:$/, "");
					addLogLine(`💬 ${parseMarkdown(text)}`, "thinking");
					currentLineRef.current = "";
					setCurrentLine("");
				}

				setDetectedPlugins(plugins);
				detectionComplete = true;

				// Only move to selection if marketplace is also loaded
				if (marketplaceLoaded) {
					moveToSelection();
				}
			},
			onError: (err: Error) => {
				if (!isMountedRef.current) return;
				setError(err.message);
				setPhase("error");
				onInstallError(err);
			},
		};

		detectPlugins(callbacks);
	}, [detectPlugins, fetchMarketplace, onInstallError, addLogLine]);

	const handleSelectionComplete = useCallback(
		(selected: string[]) => {
			setPhase("complete");
			onInstallComplete(selected);
		},
		[onInstallComplete],
	);

	// Memoize sorted detected plugins
	const sortedDetectedPlugins = useMemo(
		() => [...detectedPlugins].sort(),
		[detectedPlugins],
	);

	// Render a log line with appropriate styling
	const renderLogLine = useCallback((line: LogLine) => {
		switch (line.type) {
			case "tool":
				return <Text color="blue">{line.text}</Text>;
			case "error":
				return <Text color="red">{line.text}</Text>;
			case "thinking":
				return <Text dimColor>{line.text}</Text>;
			case "spacer":
				return <Text> </Text>;
			default:
				return <Text>{line.text}</Text>;
		}
	}, []);

	return (
		<Box flexDirection="column" paddingY={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🤖 Han Plugin Installer
				</Text>
			</Box>

			{/* Static log lines - only visible during analysis phases */}
			{(phase === "analyzing" || phase === "analyzed") && (
				<Static items={logLines}>
					{(line) => <Box key={line.id}>{renderLogLine(line)}</Box>}
				</Static>
			)}

			{phase === "analyzing" && (
				<Box marginBottom={1}>
					<Text color="yellow">
						<Spinner type="dots" /> Analyzing codebase...
					</Text>
				</Box>
			)}

			{phase === "analyzed" && (
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color="green">✅ Analysis complete</Text>
					</Box>

					{sortedDetectedPlugins.length > 0 && (
						<Box flexDirection="column" marginBottom={1}>
							<Text bold color="green">
								✨ Recommended plugins:
							</Text>
							{sortedDetectedPlugins.map((plugin) => (
								<Box key={plugin} marginLeft={2}>
									<Text>• {plugin}</Text>
								</Box>
							))}
						</Box>
					)}

					<Box marginTop={1}>
						<Text color="yellow">
							<Spinner type="dots" /> Preparing selection...
						</Text>
					</Box>
				</Box>
			)}

			{phase === "selecting" && (
				<PluginSelector
					detectedPlugins={detectedPlugins}
					installedPlugins={installedPlugins}
					allPlugins={allPlugins}
					onComplete={handleSelectionComplete}
					onCancel={onCancel}
				/>
			)}

			{phase === "complete" && (
				<Box flexDirection="column" marginTop={1}>
					<Box marginBottom={1}>
						<Text color="green">✅ Selection complete</Text>
					</Box>
				</Box>
			)}

			{phase === "error" && (
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color="red" bold>
							❌ Error: {error}
						</Text>
					</Box>
					<Box marginTop={1}>
						<Text color="yellow">
							⚠️ Falling back to installing core plugin...
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};
