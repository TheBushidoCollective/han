import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const PLUGINS_DIR = path.join(process.cwd(), '..');

export interface PluginMetadata {
  name: string;
  title: string;
  description: string;
  icon: string;
  kanji?: string;
  category: 'bushido' | 'buki' | 'do' | 'sensei';
}

export interface AgentMetadata {
  name: string;
  description: string;
  color?: string;
  model?: string;
  content: string;
}

export interface SkillMetadata {
  name: string;
  description: string;
  allowedTools?: string[];
  content: string;
}

export interface HookCommand {
  type: string;
  command: string;
}

export interface HookSection {
  section: string;
  commands: string[];
}

interface Hook {
  command?: string;
}

interface HookArray {
  hooks?: Hook[];
}

interface HooksData {
  hooks?: {
    [section: string]: HookArray[];
  };
}

export interface PluginDetails {
  metadata: PluginMetadata;
  agents: AgentMetadata[];
  skills: SkillMetadata[];
  hooks: HookSection[];
}

function getCategoryFromMarketplace(
  marketplaceCategory: string
): 'bushido' | 'buki' | 'do' | 'sensei' {
  if (marketplaceCategory === 'Core') return 'bushido';
  if (marketplaceCategory === 'Weapon') return 'buki';
  if (marketplaceCategory === 'Discipline') return 'do';
  if (marketplaceCategory === 'Teacher') return 'sensei';
  return 'buki';
}

function getCategoryIcon(
  category: 'bushido' | 'buki' | 'do' | 'sensei'
): string {
  switch (category) {
    case 'bushido':
      return '⛩️';
    case 'buki':
      return '⚔️';
    case 'do':
      return '🛤️';
    case 'sensei':
      return '👴';
    default:
      return '📦';
  }
}

function getPluginMetadata(
  pluginPath: string,
  pluginName: string,
  category: 'bushido' | 'buki' | 'do' | 'sensei'
): PluginMetadata {
  try {
    const pluginJsonPath = path.join(
      pluginPath,
      '.claude-plugin',
      'plugin.json'
    );
    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));

    return {
      name: pluginName,
      title: pluginJson.name || pluginName,
      description: pluginJson.description || '',
      icon: pluginJson.icon || getCategoryIcon(category),
      kanji: pluginJson.kanji,
      category,
    };
  } catch (error) {
    console.error(`Error reading plugin metadata for ${pluginName}:`, error);
    return {
      name: pluginName,
      title: pluginName,
      description: '',
      icon: getCategoryIcon(category),
      category,
    };
  }
}

// Get all plugins across all categories from marketplace.json
export function getAllPluginsAcrossCategories(): Array<
  PluginMetadata & { source: string }
> {
  try {
    const marketplacePath = path.join(
      PLUGINS_DIR,
      '.claude-plugin',
      'marketplace.json'
    );
    const marketplaceData = JSON.parse(
      fs.readFileSync(marketplacePath, 'utf-8')
    );

    const plugins: Array<PluginMetadata & { source: string }> = [];

    for (const plugin of marketplaceData.plugins) {
      const pluginCategory = getCategoryFromMarketplace(plugin.category);
      const pluginName = plugin.source.split('/').pop() || plugin.name;
      const pluginPath = path.join(
        PLUGINS_DIR,
        plugin.source.replace('./', '')
      );
      const metadata = getPluginMetadata(
        pluginPath,
        pluginName,
        pluginCategory
      );
      plugins.push({
        ...metadata,
        source: plugin.source,
      });
    }

    return plugins.sort((a, b) => a.title.localeCompare(b.title));
  } catch (error) {
    console.error('Error reading all plugins:', error);
    return [];
  }
}

// Get all plugins in a category from marketplace.json
export function getAllPlugins(
  category: 'bushido' | 'buki' | 'do' | 'sensei'
): PluginMetadata[] {
  try {
    const marketplacePath = path.join(
      PLUGINS_DIR,
      '.claude-plugin',
      'marketplace.json'
    );
    const marketplaceData = JSON.parse(
      fs.readFileSync(marketplacePath, 'utf-8')
    );

    const plugins: PluginMetadata[] = [];

    for (const plugin of marketplaceData.plugins) {
      const pluginCategory = getCategoryFromMarketplace(plugin.category);

      if (pluginCategory === category) {
        const pluginName = plugin.source.split('/').pop() || plugin.name;
        const pluginPath = path.join(
          PLUGINS_DIR,
          plugin.source.replace('./', '')
        );
        plugins.push(getPluginMetadata(pluginPath, pluginName, category));
      }
    }

    return plugins.sort((a, b) => a.title.localeCompare(b.title));
  } catch (error) {
    console.error(`Error reading plugins from ${category}:`, error);
    return [];
  }
}

// Parse agents from a plugin
function getPluginAgents(pluginPath: string): AgentMetadata[] {
  const agents: AgentMetadata[] = [];
  const agentsDir = path.join(pluginPath, 'agents');

  if (!fs.existsSync(agentsDir)) {
    return agents;
  }

  try {
    const agentFiles = fs
      .readdirSync(agentsDir)
      .filter((file) => file.endsWith('.md'));

    for (const file of agentFiles) {
      const filePath = path.join(agentsDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);

      agents.push({
        name: data.name || path.basename(file, '.md'),
        description: data.description || '',
        color: data.color,
        model: data.model,
        content,
      });
    }
  } catch (error) {
    console.error(`Error reading agents from ${pluginPath}:`, error);
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

// Parse skills from a plugin
function getPluginSkills(pluginPath: string): SkillMetadata[] {
  const skills: SkillMetadata[] = [];
  const skillsDir = path.join(pluginPath, 'skills');

  if (!fs.existsSync(skillsDir)) {
    return skills;
  }

  try {
    const skillDirs = fs.readdirSync(skillsDir).filter((file) => {
      const stat = fs.statSync(path.join(skillsDir, file));
      return stat.isDirectory();
    });

    for (const dir of skillDirs) {
      const skillFile = path.join(skillsDir, dir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        continue;
      }

      const fileContent = fs.readFileSync(skillFile, 'utf-8');
      const { data, content } = matter(fileContent);

      skills.push({
        name: data.name || dir,
        description: data.description || '',
        allowedTools: data['allowed-tools'],
        content,
      });
    }
  } catch (error) {
    console.error(`Error reading skills from ${pluginPath}:`, error);
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Parse hooks from a plugin
function getPluginHooks(pluginPath: string): HookSection[] {
  const hookSections: HookSection[] = [];
  const hooksFile = path.join(pluginPath, 'hooks', 'hooks.json');

  if (!fs.existsSync(hooksFile)) return hookSections;

  try {
    const hooksData = JSON.parse(
      fs.readFileSync(hooksFile, 'utf-8')
    ) as HooksData;

    if (hooksData.hooks) {
      for (const [section, hookArrays] of Object.entries(hooksData.hooks)) {
        const commands: string[] = [];

        // Each section contains an array of hook objects
        for (const hookArray of hookArrays) {
          if (hookArray.hooks) {
            for (const hook of hookArray.hooks) {
              if (hook.command) {
                commands.push(hook.command);
              }
            }
          }
        }

        if (commands.length > 0) {
          hookSections.push({
            section,
            commands,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading hooks from ${pluginPath}:`, error);
  }

  return hookSections;
}

// Get full plugin details with agents and skills
export function getPluginContent(
  category: 'bushido' | 'buki' | 'do' | 'sensei',
  slug: string
): PluginDetails | null {
  try {
    const marketplacePath = path.join(
      PLUGINS_DIR,
      '.claude-plugin',
      'marketplace.json'
    );
    const marketplaceData = JSON.parse(
      fs.readFileSync(marketplacePath, 'utf-8')
    );

    const plugin = marketplaceData.plugins.find(
      (p: { source: string; category: string }) => {
        const pluginName = p.source.split('/').pop();
        const pluginCategory = getCategoryFromMarketplace(p.category);
        return pluginName === slug && pluginCategory === category;
      }
    );

    if (!plugin) {
      return null;
    }

    const pluginPath = path.join(PLUGINS_DIR, plugin.source.replace('./', ''));
    const pluginName = plugin.source.split('/').pop() || slug;

    const metadata = getPluginMetadata(pluginPath, pluginName, category);
    const agents = getPluginAgents(pluginPath);
    const skills = getPluginSkills(pluginPath);
    const hooks = getPluginHooks(pluginPath);

    return {
      metadata,
      agents,
      skills,
      hooks,
    };
  } catch (error) {
    console.error(
      `Error getting plugin content for ${category}/${slug}:`,
      error
    );
    return null;
  }
}
