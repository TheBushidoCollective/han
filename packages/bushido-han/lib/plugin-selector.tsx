import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { MarketplacePlugin } from './shared.js';

interface PluginSelectorProps {
  detectedPlugins: string[];
  installedPlugins?: string[];
  allPlugins: MarketplacePlugin[];
  onComplete: (selected: string[]) => void;
  onCancel: () => void;
}

type Mode = 'selection' | 'search';

export const PluginSelector: React.FC<PluginSelectorProps> = ({
  detectedPlugins,
  installedPlugins = [],
  allPlugins,
  onComplete,
  onCancel,
}) => {
  const [mode, setMode] = useState<Mode>('selection');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Initialize with only recommended plugins (detected), excluding bushido
  // Installed but no longer recommended plugins will be shown but deselected
  const initialSelection = useMemo(() => {
    return new Set(detectedPlugins.filter((p) => p !== 'bushido'));
  }, [detectedPlugins]);

  const [selectedPlugins, setSelectedPlugins] =
    useState<Set<string>>(initialSelection);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MarketplacePlugin[]>([]);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);

  // Memoize options list to prevent recreation on every render
  // Note: "bushido" is always installed and never shown in the selector
  const options = useMemo(() => {
    const opts: Array<{
      name: string;
      isPlugin: boolean;
      isRecommended?: boolean;
      isInstalled?: boolean;
    }> = [];

    // Build set of plugins to show: installed OR recommended OR selected (excluding bushido)
    const pluginsToShow = new Set([
      ...installedPlugins.filter((p) => p !== 'bushido'),
      ...detectedPlugins.filter((p) => p !== 'bushido'),
      ...Array.from(selectedPlugins).filter((p) => p !== 'bushido'),
    ]);

    // Sort and add to options
    const sortedPlugins = Array.from(pluginsToShow).sort();
    for (const plugin of sortedPlugins) {
      opts.push({
        name: plugin,
        isPlugin: true,
        isRecommended: detectedPlugins.includes(plugin),
        isInstalled: installedPlugins.includes(plugin),
      });
    }

    // Add action options
    opts.push({ name: '🔍 Search for more plugins', isPlugin: false });
    opts.push({ name: '✅ Done - Install selected plugins', isPlugin: false });
    opts.push({ name: '❌ Cancel', isPlugin: false });

    return opts;
  }, [detectedPlugins, installedPlugins, selectedPlugins]);

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
        if (plugin.name === 'bushido') return false;

        const nameMatch = plugin.name.toLowerCase().includes(lowerQuery);
        const descMatch = plugin.description
          ?.toLowerCase()
          .includes(lowerQuery);
        const keywordMatch = plugin.keywords?.some((k) =>
          k.toLowerCase().includes(lowerQuery)
        );
        const categoryMatch = plugin.category
          ?.toLowerCase()
          .includes(lowerQuery);
        return nameMatch || descMatch || keywordMatch || categoryMatch;
      });

      setSearchResults(results.slice(0, 10)); // Limit to 10 results
    },
    [allPlugins]
  );

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (mode === 'selection') {
        // Navigation
        if (key.upArrow) {
          setSelectedIndex(Math.max(0, selectedIndex - 1));
        } else if (key.downArrow) {
          setSelectedIndex(Math.min(options.length - 1, selectedIndex + 1));
        } else if (input === ' ') {
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
          if (option.name === '🔍 Search for more plugins') {
            setMode('search');
            setSearchQuery('');
            setSearchResults([]);
            setSearchSelectedIndex(0);
          } else if (option.name === '✅ Done - Install selected plugins') {
            onComplete(Array.from(selectedPlugins));
          } else if (option.name === '❌ Cancel') {
            onCancel();
          }
        } else if (key.escape) {
          onCancel();
        }
      }
    },
    { isActive: mode === 'selection' }
  );

  // Handle escape in search mode (always active in search)
  useInput(
    (_input, key) => {
      if (key.escape) {
        setMode('selection');
        setSearchResults([]);
        setSearchQuery('');
      }
    },
    { isActive: mode === 'search' }
  );

  // Handle search result navigation (only when results exist)
  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSearchSelectedIndex(Math.max(0, searchSelectedIndex - 1));
      } else if (key.downArrow) {
        // +1 for "Back" option
        setSearchSelectedIndex(
          Math.min(searchResults.length, searchSelectedIndex + 1)
        );
      } else if (key.return) {
        if (searchSelectedIndex < searchResults.length) {
          // Add selected plugin
          const plugin = searchResults[searchSelectedIndex];
          setSelectedPlugins((prev) => new Set([...prev, plugin.name]));
        }
        // Go back to selection mode
        setMode('selection');
        setSelectedIndex(0);
      }
    },
    { isActive: mode === 'search' && searchResults.length > 0 }
  );

  if (mode === 'selection') {
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

          let displayName = option.name;
          if (option.isPlugin && option.isRecommended) {
            displayName = `${option.name} ⭐`;
          } else if (option.isPlugin && option.isInstalled) {
            displayName = `${option.name} (installed)`;
          }

          return (
            <Box key={`option-${index}`} marginLeft={1}>
              <Text
                color={isSelected ? 'cyan' : undefined}
                bold={isSelected}
                inverse={isSelected}
              >
                {isSelected ? '> ' : '  '}
                {option.isPlugin ? (isChecked ? '[✓] ' : '[ ] ') : ''}
                {displayName}
              </Text>
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text dimColor>
            {selectedPlugins.size} plugin(s) selected • ⭐ = recommended • Use
            ↑↓ arrows to navigate • Space to toggle • Enter to select
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
              <Box
                key={`search-${index}`}
                marginLeft={1}
                flexDirection="column"
              >
                <Text
                  color={isSelected ? 'cyan' : undefined}
                  bold={isSelected}
                  inverse={isSelected}
                >
                  {isSelected ? '> ' : '  '}
                  {plugin.name} {isAlreadyAdded && '(already added)'}
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
              color={
                searchSelectedIndex === searchResults.length
                  ? 'cyan'
                  : undefined
              }
              bold={searchSelectedIndex === searchResults.length}
              inverse={searchSelectedIndex === searchResults.length}
            >
              {searchSelectedIndex === searchResults.length ? '> ' : '  '}← Back
              to selection
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
