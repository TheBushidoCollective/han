import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPlugins } from '../../../lib/plugins';
import Sidebar from '../../components/Sidebar';

export async function generateStaticParams() {
  return [
    { category: 'bushido' },
    { category: 'buki' },
    { category: 'do' },
    { category: 'sensei' },
  ];
}

const categoryData = {
  bushido: {
    title: 'Bushido',
    subtitle: '武士道 - The Way of the Warrior',
    icon: '⛩️',
    description:
      'Core principles and best practices for software development. These skills embody the fundamental disciplines that guide exceptional engineering.',
  },
  buki: {
    title: 'Buki',
    subtitle: '武器 - Weapons',
    icon: '⚔️',
    description:
      'Language and tool skills with validation hooks for maintaining quality. Each Buki plugin provides specialized knowledge for a specific programming language, framework, or development tool.',
  },
  do: {
    title: 'Dō',
    subtitle: '道 - The Way',
    icon: '🛤️',
    description:
      'Specialized discipline agents for focused expertise areas. Each Dō plugin contains agents that embody specific engineering disciplines and methodologies.',
  },
  sensei: {
    title: 'Sensei',
    subtitle: '先生 - Teacher',
    icon: '👴',
    description:
      "MCP servers that extend Claude Code's capabilities. These plugins integrate external services and tools to enhance Claude's abilities.",
  },
} as const;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  if (!['bushido', 'buki', 'do', 'sensei'].includes(category)) {
    notFound();
  }

  const categoryKey = category as keyof typeof categoryData;
  const categoryInfo = categoryData[categoryKey];
  const plugins = getAllPlugins(categoryKey);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="text-4xl">⛩️</div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Han
              </h1>
            </Link>
            <div className="hidden md:flex space-x-8">
              <Link
                href="/docs"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Documentation
              </Link>
              <a
                href="https://github.com/thebushidocollective/han"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                GitHub
              </a>
            </div>
          </div>
        </nav>
      </header>

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
          <span className="text-gray-900 dark:text-white font-medium">
            {categoryInfo.title}
          </span>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex gap-12">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <div className="mb-12">
              <div className="flex items-center space-x-4 mb-4">
                <div className="text-6xl">{categoryInfo.icon}</div>
                <div>
                  <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
                    {categoryInfo.title}
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-400 mt-1">
                    {categoryInfo.subtitle}
                  </p>
                </div>
              </div>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mt-6">
                {categoryInfo.description}
              </p>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-12 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Plugins
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {plugins.length}
                  </p>
                </div>
                <div className="text-5xl">{categoryInfo.icon}</div>
              </div>
            </div>

            {/* Plugin List */}
            <section>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                All {categoryInfo.title} Plugins
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plugins.map((plugin) => (
                  <Link
                    key={plugin.name}
                    href={`/plugins/${category}/${
                      category === 'bushido' ? 'core' : plugin.name
                    }`}
                    className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 transition block group"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-gray-700 dark:group-hover:text-gray-200">
                      {plugin.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {plugin.description}
                    </p>
                    <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-gray-700 dark:text-gray-300 block">
                      {plugin.name}@han
                    </code>
                  </Link>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
