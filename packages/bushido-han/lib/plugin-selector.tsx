import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useCallback, useMemo, useState } from "react";
import type { MarketplacePlugin } from "./shared.js";

interface PluginSelectorProps {
	detectedPlugins: string[];
	allPlugins: MarketplacePlugin[];
	onComplete: (selected: string[]) => void;
	onCancel: () => void;
}

type Mode = "selection" | "search";

export const PluginSelector: React.FC<PluginSelectorProps> = ({
	detectedPlugins,
	allPlugins,
	onComplete,
	onCancel,
}) => {
	const [mode, setMode] = useState<Mode>("selection");
	const [selectedIndex, setSelectedIndex] = useState(0);
	// Initialize with detected plugins, excluding bushido (always installed separately)
	const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>(
		new Set(detectedPlugins.filter((p) => p !== "bushido")),
	);
	// Track plugins added via search (separate from detected)
	const [addedPlugins, setAddedPlugins] = useState<string[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<MarketplacePlugin[]>([]);
	const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);

	// Memoize options list to prevent recreation on every render
	// Note: "bushido" is always installed and never shown in the selector
	const options = useMemo(() => {
		const opts: Array<{ name: string; isPlugin: boolean }> = [];

		// Add detected plugins + added plugins (deduped, sorted, excluding bushido)
		const allPluginNames = [...new Set([...detectedPlugins, ...addedPlugins])]
			.filter((p) => p !== "bushido")
			.sort();
		for (const plugin of allPluginNames) {
			opts.push({ name: plugin, isPlugin: true });
		}

		// Add action options
		opts.push({ name: "🔍 Search for more plugins", isPlugin: false });
		opts.push({ name: "✅ Done - Install selected plugins", isPlugin: false });
		opts.push({ name: "❌ Cancel", isPlugin: false });

		return opts;
	}, [detectedPlugins, addedPlugins]);

	// Memoize search function (excludes bushido from results)
	const performSearch = useCallback(
		(query: string) => {
			if (!query.trim()) {
				setSearchResults([]);
				return;
			}

			const lowerQuery = query.toLowerCase();
			const results = allPlugins.filter((plugin) => {
				// Never show bushido in search - it's always installed
				if (plugin.name === "bushido") return false;

				const nameMatch = plugin.name.toLowerCase().includes(lowerQuery);
				const descMatch = plugin.description?.toLowerCase().includes(lowerQuery);
				const keywordMatch = plugin.keywords?.some((k) =>
					k.toLowerCase().includes(lowerQuery),
				);
				const categoryMatch = plugin.category?.toLowerCase().includes(lowerQuery);
				return nameMatch || descMatch || keywordMatch || categoryMatch;
			});

			setSearchResults(results.slice(0, 10)); // Limit to 10 results
		},
		[allPlugins],
	);

	// Handle keyboard navigation
	useInput(
		(input, key) => {
			if (mode === "selection") {
				// Navigation
				if (key.upArrow) {
					setSelectedIndex(Math.max(0, selectedIndex - 1));
				} else if (key.downArrow) {
					setSelectedIndex(Math.min(options.length - 1, selectedIndex + 1));
				} else if (input === " ") {
					// Toggle selection with spacebar
					const option = options[selectedIndex];
					if (option.isPlugin) {
						setSelectedPlugins((prev) => {
							const newSet = new Set(prev);
							if (newSet.has(option.name)) {
								newSet.delete(option.name);
							} else {
								newSet.add(option.name);
							}
							return newSet;
						});
					}
				} else if (key.return) {
					// Handle selection
					const option = options[selectedIndex];
					if (option.name === "🔍 Search for more plugins") {
						setMode("search");
						setSearchQuery("");
						setSearchResults([]);
						setSearchSelectedIndex(0);
					} else if (option.name === "✅ Done - Install selected plugins") {
						onComplete(Array.from(selectedPlugins));
					} else if (option.name === "❌ Cancel") {
						onCancel();
					}
				} else if (key.escape) {
					onCancel();
				}
			}
		},
		{ isActive: mode === "selection" }
	);

	// Handle escape in search mode (always active in search)
	useInput(
		(_input, key) => {
			if (key.escape) {
				setMode("selection");
				setSearchResults([]);
				setSearchQuery("");
			}
		},
		{ isActive: mode === "search" },
	);

	// Handle search result navigation (only when results exist)
	useInput(
		(_input, key) => {
			if (key.upArrow) {
				setSearchSelectedIndex(Math.max(0, searchSelectedIndex - 1));
			} else if (key.downArrow) {
				// +1 for "Back" option
				setSearchSelectedIndex(
					Math.min(searchResults.length, searchSelectedIndex + 1),
				);
			} else if (key.return) {
				if (searchSelectedIndex < searchResults.length) {
					// Add selected plugin
					const plugin = searchResults[searchSelectedIndex];
					setSelectedPlugins((prev) => new Set([...prev, plugin.name]));
					setAddedPlugins((prev) =>
						prev.includes(plugin.name) ? prev : [...prev, plugin.name],
					);
				}
				// Go back to selection mode
				setMode("selection");
				setSelectedIndex(0);
			}
		},
		{ isActive: mode === "search" && searchResults.length > 0 },
	);

	if (mode === "selection") {
		return (
			<Box flexDirection="column" paddingY={1}>
				<Box marginBottom={1}>
					<Text bold color="cyan">
						Select plugins to install (Space to toggle, Enter to confirm):
					</Text>
				</Box>

				{options.map((option, index) => {
					const isSelected = index === selectedIndex;
					const isChecked = option.isPlugin && selectedPlugins.has(option.name);

					return (
						<Box key={option.name} marginLeft={1}>
							<Text
								color={isSelected ? "cyan" : undefined}
								bold={isSelected}
								inverse={isSelected}
							>
								{isSelected ? "> " : "  "}
								{option.isPlugin ? (isChecked ? "[✓] " : "[ ] ") : ""}
								{option.name}
							</Text>
						</Box>
					);
				})}

				<Box marginTop={1}>
					<Text dimColor>
						{selectedPlugins.size} plugin(s) selected • Use ↑↓ arrows to
						navigate • Space to toggle • Enter to select
					</Text>
				</Box>
			</Box>
		);
	}

	// mode === "search" - show input and results together
	return (
		<Box flexDirection="column" paddingY={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Search for plugins (ESC to go back):
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>Search: </Text>
				<TextInput
					value={searchQuery}
					onChange={(value) => {
						setSearchQuery(value);
						// Perform live search
						performSearch(value);
						setSearchSelectedIndex(0);
					}}
				/>
			</Box>

			{searchResults.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Box marginBottom={1}>
						<Text dimColor>↑↓ navigate, Enter to add, ESC to go back</Text>
					</Box>

					{searchResults.map((plugin, index) => {
						const isSelected = index === searchSelectedIndex;
						const isAlreadyAdded = selectedPlugins.has(plugin.name);

						return (
							<Box key={plugin.name} marginLeft={1} flexDirection="column">
								<Text
									color={isSelected ? "cyan" : undefined}
									bold={isSelected}
									inverse={isSelected}
								>
									{isSelected ? "> " : "  "}
									{plugin.name} {isAlreadyAdded && "(already added)"}
								</Text>
								{isSelected && plugin.description && (
									<Box marginLeft={4}>
										<Text dimColor>{plugin.description}</Text>
									</Box>
								)}
							</Box>
						);
					})}

					<Box marginLeft={1} marginTop={1}>
						<Text
							color={searchSelectedIndex === searchResults.length ? "cyan" : undefined}
							bold={searchSelectedIndex === searchResults.length}
							inverse={searchSelectedIndex === searchResults.length}
						>
							{searchSelectedIndex === searchResults.length ? "> " : "  "}
							← Back to selection
						</Text>
					</Box>
				</Box>
			)}

			{searchQuery && searchResults.length === 0 && (
				<Box marginLeft={1} marginTop={1}>
					<Text color="yellow">No plugins found matching "{searchQuery}"</Text>
				</Box>
			)}
		</Box>
	);
};
