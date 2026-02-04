import { render } from 'ink';
import type React from 'react';
import type { MarketplacePlugin } from '../shared/index.ts';
import { PluginSelector } from './plugin-selector.tsx';

/**
 * Show interactive plugin selector and return selected plugin names
 */
export async function showPluginSelector(
  searchResults: MarketplacePlugin[],
  installedPlugins: string[],
  allPlugins: MarketplacePlugin[]
): Promise<string[]> {
  return new Promise((resolve) => {
    const PluginSelectorApp: React.FC = () => (
      <PluginSelector
        detectedPlugins={searchResults.map((p) => p.name)}
        installedPlugins={installedPlugins}
        allPlugins={allPlugins}
        onComplete={(selected) => {
          unmount();
          resolve(selected);
        }}
        onCancel={() => {
          unmount();
          resolve([]);
        }}
      />
    );

    const { unmount } = render(<PluginSelectorApp />);
  });
}
