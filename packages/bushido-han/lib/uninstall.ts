import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HAN_MARKETPLACE_URL = 'https://github.com/thebushidocollective/sensei';

interface ClaudeSettings {
  extraMarketplaces?: string[];
  plugins?: string[];
  [key: string]: unknown;
}

function getClaudeSettingsPath(): string {
  const rootDir = process.cwd();
  return join(rootDir, '.claude', 'settings.json');
}

function readSettings(): ClaudeSettings | null {
  const settingsPath = getClaudeSettingsPath();

  if (!existsSync(settingsPath)) {
    console.log('No .claude/settings.json found. Nothing to uninstall.');
    return null;
  }

  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
  } catch (error) {
    console.error('Error reading settings.json:', (error as Error).message);
    return null;
  }
}

function writeSettings(settings: ClaudeSettings): void {
  const settingsPath = getClaudeSettingsPath();
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

export function uninstall(): void {
  console.log(
    '🗑️  Removing Han marketplace and plugins from Claude Code settings...\n'
  );

  const settings = readSettings();
  if (!settings) {
    process.exit(0);
  }

  let changes = false;

  // Remove Han marketplace from extraMarketplaces
  if (settings.extraMarketplaces) {
    const before = settings.extraMarketplaces.length;
    settings.extraMarketplaces = settings.extraMarketplaces.filter(
      (url) => url !== HAN_MARKETPLACE_URL
    );
    const after = settings.extraMarketplaces.length;

    if (before > after) {
      console.log(`✓ Removed Han marketplace: ${HAN_MARKETPLACE_URL}`);
      changes = true;
    }

    if (settings.extraMarketplaces.length === 0) {
      delete settings.extraMarketplaces;
    }
  }

  // Remove all Han plugins (those starting with buki-, do-, sensei-, or named bushido)
  if (settings.plugins) {
    const before = settings.plugins.length;
    settings.plugins = settings.plugins.filter(
      (plugin) =>
        !plugin.startsWith('buki-') &&
        !plugin.startsWith('do-') &&
        !plugin.startsWith('sensei-') &&
        plugin !== 'bushido'
    );
    const after = settings.plugins.length;
    const removed = before - after;

    if (removed > 0) {
      console.log(`✓ Removed ${removed} Han plugin(s)`);
      changes = true;
    }

    if (settings.plugins.length === 0) {
      delete settings.plugins;
    }
  }

  if (!changes) {
    console.log('No Han marketplace or plugins found in settings.');
    process.exit(0);
  }

  writeSettings(settings);

  console.log('\n✅ Uninstallation complete!');
  console.log('\nRemaining configuration in .claude/settings.json:');
  if (settings.plugins && settings.plugins.length > 0) {
    console.log(`  Plugins: ${settings.plugins.length}`);
    for (const plugin of settings.plugins) {
      console.log(`    - ${plugin}`);
    }
  } else {
    console.log('  No plugins configured');
  }
  if (settings.extraMarketplaces && settings.extraMarketplaces.length > 0) {
    console.log(`  Marketplaces: ${settings.extraMarketplaces.length}`);
    for (const marketplace of settings.extraMarketplaces) {
      console.log(`    - ${marketplace}`);
    }
  } else {
    console.log('  No extra marketplaces configured');
  }
  console.log('\nRestart Claude Code to apply changes.');
}
