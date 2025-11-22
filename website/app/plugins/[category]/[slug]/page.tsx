import type { Metadata } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllPlugins,
  getAllPluginsAcrossCategories,
  getPluginContent,
} from '../../../../lib/plugins';
import Header from '../../../components/Header';
import InstallationTabs from '../../../components/InstallationTabs';
import RelatedPlugins from '../../../components/RelatedPlugins';
import Sidebar from '../../../components/Sidebar';

export async function generateStaticParams() {
  const categories = ['bushido', 'buki', 'do', 'sensei'] as const;
  const params: { category: string; slug: string }[] = [];

  for (const category of categories) {
    const plugins = getAllPlugins(category);
    for (const plugin of plugins) {
      params.push({
        category,
        slug: category === 'bushido' ? 'core' : plugin.name,
      });
    }
  }

  return params;
}

const categoryLabels = {
  bushido: 'Bushido',
  buki: 'Buki',
  do: 'Dō',
  sensei: 'Sensei',
} as const;

const hookDescriptions: Record<string, string> = {
  PreToolUse:
    'Runs after Claude creates tool parameters and before processing the tool call.',
  PermissionRequest: 'Runs when the user is shown a permission dialog.',
  PostToolUse: 'Runs immediately after a tool completes successfully.',
  Notification: 'Runs when Claude Code sends notifications.',
  UserPromptSubmit:
    'Runs when the user submits a prompt, before Claude processes it.',
  Stop: 'Runs when the main Claude Code agent has finished responding.',
  SubagentStop:
    'Runs when a Claude Code subagent (Task tool call) has finished responding.',
  PreCompact: 'Runs before Claude Code is about to run a compact operation.',
  SessionStart:
    'Runs when Claude Code starts a new session or resumes an existing session.',
  SessionEnd: 'Runs when a Claude Code session ends.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;

  if (!['bushido', 'buki', 'do', 'sensei'].includes(category)) {
    return {
      title: 'Plugin Not Found - Han',
    };
  }

  const pluginSlug =
    category === 'bushido' && slug === 'core' ? 'bushido' : slug;
  const plugin = getPluginContent(
    category as 'bushido' | 'buki' | 'do' | 'sensei',
    pluginSlug
  );

  if (!plugin) {
    return {
      title: 'Plugin Not Found - Han',
    };
  }

  return {
    title: `${plugin.metadata.title} - Han`,
    description: plugin.metadata.description,
  };
}

export default async function PluginPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;

  // Validate category
  if (!['bushido', 'buki', 'do', 'sensei'].includes(category)) {
    notFound();
  }

  const pluginSlug =
    category === 'bushido' && slug === 'core' ? 'bushido' : slug;
  const plugin = getPluginContent(
    category as 'bushido' | 'buki' | 'do' | 'sensei',
    pluginSlug
  );

  if (!plugin) {
    notFound();
  }

  // Load plugin metadata for tags
  const pluginJsonPath = path.join(
    process.cwd(),
    '..',
    plugin.metadata.category === 'bushido'
      ? 'bushido'
      : `${plugin.metadata.category}/${plugin.metadata.name}`,
    '.claude-plugin/plugin.json'
  );
  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
  const tags = pluginJson.keywords || [];

  // Find related plugins
  const allPlugins = getAllPluginsAcrossCategories();
  const relatedPlugins = allPlugins
    .filter((p) => p.name !== plugin.metadata.name)
    .map((p) => {
      const pJsonPath = path.join(
        process.cwd(),
        '..',
        p.source,
        '.claude-plugin/plugin.json'
      );
      const pJson = JSON.parse(fs.readFileSync(pJsonPath, 'utf-8'));
      const pTags = pJson.keywords || [];
      const sharedTags = pTags.filter((t: string) => tags.includes(t));
      const sameCategory = p.category === plugin.metadata.category ? 1 : 0;
      return {
        name: p.name,
        description: p.description,
        category: p.category,
        sharedTags,
        score: sharedTags.length + sameCategory,
      };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Header showSearch={true} />

      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <Link
            href="/docs"
            className="hover:text-gray-900 dark:hover:text-white"
          >
            Documentation
          </Link>
          <span>/</span>
          <Link
            href={`/plugins/${category}`}
            className="hover:text-gray-900 dark:hover:text-white"
          >
            {categoryLabels[category as keyof typeof categoryLabels]}
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {plugin.metadata.title}
          </span>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex gap-12">
          <Sidebar />
          <main className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-4 mb-4">
                <div className="text-6xl">{plugin.metadata.icon}</div>
                <div>
                  <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
                    {plugin.metadata.title}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                    {plugin.metadata.description}
                  </p>
                </div>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {tags.map((tag: string) => (
                    <Link
                      key={tag}
                      href={`/tags?tag=${encodeURIComponent(tag)}`}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Installation */}
            <section className="mb-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Installation
              </h2>
              <InstallationTabs pluginName={plugin.metadata.name} />
            </section>

            {/* Agents Section */}
            {plugin.agents.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                  Agents
                </h2>
                <div className="space-y-4">
                  {plugin.agents.map((agent) => (
                    <Link
                      key={agent.name}
                      href={`/plugins/${category}/${slug}/agents/${agent.name}`}
                      className="block bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">🤖</div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {agent.name}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300">
                            {agent.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Skills Section */}
            {plugin.skills.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                  Skills
                </h2>
                <div className="space-y-4">
                  {plugin.skills.map((skill) => (
                    <Link
                      key={skill.name}
                      href={`/plugins/${category}/${slug}/skills/${skill.name}`}
                      className="block bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">📖</div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {skill.name}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300">
                            {skill.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Hooks Section */}
            {plugin.hooks.length > 0 && (
              <section className="mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                  Hooks
                </h2>
                <div className="space-y-4">
                  {plugin.hooks.map((hookSection) => (
                    <div
                      key={hookSection.section}
                      className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="text-2xl">🪝</div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {hookSection.section}
                          </h3>
                          {hookDescriptions[hookSection.section] && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {hookDescriptions[hookSection.section]}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3 mb-4">
                        {hookSection.commands.map((command) => (
                          <pre
                            key={command}
                            className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto text-sm"
                          >
                            <code>{command}</code>
                          </pre>
                        ))}
                      </div>
                      {hookSection.files.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Referenced Files:
                          </h4>
                          <div className="grid gap-2">
                            {hookSection.files.map((file) => (
                              <Link
                                key={file.name}
                                href={`/plugins/${category}/${slug}/hooks/${file.name}`}
                                className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-950 transition border border-gray-200 dark:border-gray-700"
                              >
                                <span className="text-lg">📄</span>
                                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                                  {file.path}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Related Plugins */}
            {relatedPlugins.length > 0 && (
              <RelatedPlugins plugins={relatedPlugins} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
