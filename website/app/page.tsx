import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Han - Sophisticated Claude Code Plugins with Superior Accuracy',
  description:
    'A curated marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues. Master your craft through disciplined practice, quality craftsmanship, and continuous improvement.',
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-4xl">⛩️</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                Han
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#plugins"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Plugins
              </a>
              <a
                href="#learning-paths"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Learning Paths
              </a>
              <a
                href="/docs"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Docs
              </a>
              <a
                href="#getting-started"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Get Started
              </a>
              <a
                href="https://github.com/thebushidocollective/han"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                aria-label="GitHub Repository"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          Sophisticated Claude Code Plugins with Superior Accuracy
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
          A curated marketplace of Claude Code plugins built on the foundation
          of the seven Bushido virtues. Master your craft through disciplined
          practice, quality craftsmanship, and continuous improvement.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#getting-started"
            className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition"
          >
            Get Started
          </a>
          <a
            href="https://github.com/thebushidocollective/han"
            className="px-8 py-3 border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Plugin Categories */}
      <section id="plugins" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Plugin Categories
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto">
            Inspired by Japanese samurai traditions
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <CategoryCard
              href="/plugins/bushido"
              icon="🎯"
              title="Bushido"
              subtitle="武士道"
              description="Core principles, enforcement hooks, and foundational quality skills"
            />
            <CategoryCard
              href="/plugins/buki"
              icon="⚔️"
              title="Buki"
              subtitle="武器 - Weapons"
              description="Language and tool skills with validation hooks for quality"
            />
            <CategoryCard
              href="/plugins/do"
              icon="🛤️"
              title="Dō"
              subtitle="道 - The Way"
              description="Specialized agents for development disciplines and practices"
            />
            <CategoryCard
              href="/plugins/sensei"
              icon="👴"
              title="Sensei"
              subtitle="先生 - Teachers"
              description="MCP servers providing external knowledge and integrations"
            />
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section id="getting-started" className="bg-white dark:bg-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Getting Started
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto">
            Three ways to add Han to your Claude Code workflow
          </p>
          <div className="max-w-4xl mx-auto space-y-6">
            <InstallMethodCard
              number="1"
              title="Automatic Installation"
              description="Use the han CLI tool to automatically detect and install appropriate plugins. Use --scope to control where plugins are installed (default: user)."
              code={`# Install to user settings (default)
npx @thebushidocollective/han install

# Install to project settings
npx @thebushidocollective/han install --scope project

# Install to local settings
npx @thebushidocollective/han install --scope local`}
            />
            <InstallMethodCard
              number="2"
              title="Via claude CLI"
              description="Use Claude Code's built-in plugin command"
              code="claude plugin marketplace add thebushidocollective/han"
            />
            <InstallMethodCard
              number="3"
              title="Via /plugin Command"
              description="Use Claude Code's built-in plugin command"
              code="/plugin marketplace add thebushidocollective/han"
            />
            <InstallMethodCard
              number="4"
              title="Manual Configuration"
              description="Add to .claude/settings.json"
              code={`{
  "extraKnownMarketplaces": {
    "han": {
      "source": {
        "source": "github",
        "repo": "thebushidocollective/han"
      }
    }
  }
}`}
            />
          </div>
        </div>
      </section>

      {/* Learning Paths */}
      <section id="learning-paths" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Learning Paths
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto">
            Choose your path to mastery
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <PathCard
              title="Shu - 守"
              subtitle="Beginner's Path"
              items={[
                {
                  text: 'Learn the seven virtues with ',
                  link: '/plugins/bushido',
                  linkText: 'bushido',
                },
                {
                  text: 'Choose your primary discipline (one ',
                  link: '/plugins/do',
                  linkText: 'Dō',
                  after: ')',
                },
                {
                  text: 'Master one weapon first (one ',
                  link: '/plugins/buki',
                  linkText: 'Buki',
                  after: ')',
                },
              ]}
            />
            <PathCard
              title="Ha - 破"
              subtitle="Intermediate Path"
              items={[
                {
                  text: 'Practice several disciplines (multiple ',
                  link: '/plugins/do',
                  linkText: 'Dō',
                  after: ')',
                },
                {
                  text: 'Expand your arsenal (multiple ',
                  link: '/plugins/buki',
                  linkText: 'Buki',
                  after: ')',
                },
                {
                  text: 'Seek wisdom from teachers (',
                  link: '/plugins/sensei',
                  linkText: 'Sensei',
                  after: ')',
                },
              ]}
            />
            <PathCard
              title="Ri - 離"
              subtitle="Advanced Path"
              items={[
                {
                  text: 'Master multiple ways (all ',
                  link: '/plugins/do',
                  linkText: 'Dō',
                  after: ')',
                },
                {
                  text: 'Contribute new weapons (create ',
                  link: '/plugins/buki',
                  linkText: 'Buki',
                  after: ')',
                },
                {
                  text: 'Share wisdom with others (become ',
                  link: '/plugins/sensei',
                  linkText: 'Sensei',
                  after: ')',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Han</h3>
              <p className="text-gray-400">
                Built by The Bushido Collective - developers committed to honor,
                quality, and continuous improvement.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Links</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://github.com/thebushidocollective/han"
                    className="text-gray-400 hover:text-white"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/thebushidocollective/han/blob/main/CONTRIBUTING.md"
                    className="text-gray-400 hover:text-white"
                  >
                    Contributing
                  </a>
                </li>
                <li>
                  <a
                    href="https://thebushido.co"
                    className="text-gray-400 hover:text-white"
                  >
                    The Bushido Collective
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Philosophy</h3>
              <p className="text-gray-400 italic">
                "Beginning is easy - continuing is hard."
              </p>
              <p className="text-gray-400 text-sm mt-2">- Japanese Proverb</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>
              MIT License - Walk the way of Bushido. Practice with Discipline.
              Build with Honor.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CategoryCard({
  href,
  icon,
  title,
  subtitle,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-gray-700 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-gray-900 dark:hover:border-gray-400 transition block group"
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-gray-700 dark:group-hover:text-gray-200">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {subtitle}
      </p>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </Link>
  );
}

function InstallMethodCard({
  number,
  title,
  description,
  code,
}: {
  number: string;
  title: string;
  description: string;
  code: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full flex items-center justify-center font-bold mr-3">
          {number}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>
      <pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function PathCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{
    text: string;
    link: string;
    linkText: string;
    after?: string;
  }>;
}) {
  return (
    <div className="bg-white dark:bg-gray-700 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{subtitle}</p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.link} className="flex items-start">
            <span className="text-gray-900 dark:text-white mr-2">•</span>
            <span className="text-gray-700 dark:text-gray-300">
              {item.text}
              <Link
                href={item.link}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                {item.linkText}
              </Link>
              {item.after}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
