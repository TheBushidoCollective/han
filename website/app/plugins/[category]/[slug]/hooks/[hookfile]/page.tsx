import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Header from '../../../../../../components/Header';
import Sidebar from '../../../../../../components/Sidebar';
import {
  getAllPluginsAcrossCategories,
  getPluginContent,
} from '../../../../../../lib/plugins';

export async function generateStaticParams() {
  const allPlugins = getAllPluginsAcrossCategories();
  const params: { category: string; slug: string; hookfile: string }[] = [];

  for (const plugin of allPlugins) {
    const pluginPath = path.join(process.cwd(), '..', plugin.source);
    const hooksDir = path.join(pluginPath, 'hooks');

    if (fs.existsSync(hooksDir)) {
      const files = fs
        .readdirSync(hooksDir)
        .filter((file) => file.endsWith('.md'));

      for (const file of files) {
        params.push({
          category: plugin.category,
          slug: plugin.name,
          hookfile: path.basename(file, '.md'),
        });
      }
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

export default async function HookFilePage({
  params,
}: {
  params: Promise<{ category: string; slug: string; hookfile: string }>;
}) {
  const { category, slug, hookfile } = await params;

  // Validate category
  if (!['bushido', 'buki', 'do', 'sensei'].includes(category)) {
    notFound();
  }

  const plugin = getPluginContent(
    category as 'bushido' | 'buki' | 'do' | 'sensei',
    slug
  );

  if (!plugin) {
    notFound();
  }

  // Find the hook file across all hook sections
  let hookFile: { name: string; path: string; content: string } | null = null;

  for (const hookSection of plugin.hooks) {
    const found = hookSection.files.find((f) => f.name === hookfile);
    if (found) {
      hookFile = found;
      break;
    }
  }

  // If not found in referenced files, try to load directly
  if (!hookFile) {
    const pluginPath = path.join(
      process.cwd(),
      '..',
      plugin.metadata.category === 'bushido'
        ? 'bushido'
        : `${plugin.metadata.category}/${plugin.metadata.name}`
    );
    const filePath = path.join(pluginPath, 'hooks', `${hookfile}.md`);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      hookFile = {
        name: hookfile,
        path: `${hookfile}.md`,
        content,
      };
    } else {
      notFound();
    }
  }

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
          <Link
            href={`/plugins/${category}/${slug}`}
            className="hover:text-gray-900 dark:hover:text-white"
          >
            {plugin.metadata.title}
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {hookFile.name}
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
                <div className="text-6xl">📄</div>
                <div>
                  <h1 className="text-5xl font-bold text-gray-900 dark:text-white">
                    {hookFile.name}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                    Hook File
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <ReactMarkdown>{hookFile.content}</ReactMarkdown>
            </article>

            {/* Back Link */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <Link
                href={`/plugins/${category}/${slug}`}
                className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to {plugin.metadata.title}
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
