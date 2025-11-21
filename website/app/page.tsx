export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-4xl">⚔️</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Han</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">藩 - The Bushido Code Marketplace</p>
              </div>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#philosophy" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Philosophy</a>
              <a href="#plugins" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Plugins</a>
              <a href="#getting-started" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Get Started</a>
              <a href="https://github.com/thebushidocollective/han" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">GitHub</a>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          Honor in Software Development
        </h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
          A curated marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues.
          Master your craft through disciplined practice, quality craftsmanship, and continuous improvement.
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

      {/* The Seven Virtues */}
      <section id="philosophy" className="bg-white dark:bg-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            The Seven Virtues
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto">
            The Bushido Code guides every plugin in this marketplace
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <VirtueCard
              kanji="誠"
              title="Honesty"
              description="Write code with clarity and transparency"
            />
            <VirtueCard
              kanji="礼"
              title="Respect"
              description="Honor those who came before and those who will follow"
            />
            <VirtueCard
              kanji="勇"
              title="Courage"
              description="Do the right thing, even when difficult"
            />
            <VirtueCard
              kanji="同情"
              title="Compassion"
              description="Write with empathy for users and developers"
            />
            <VirtueCard
              kanji="忠誠"
              title="Loyalty"
              description="Stay committed to quality and continuous improvement"
            />
            <VirtueCard
              kanji="自制"
              title="Discipline"
              description="Master your tools and craft"
            />
            <VirtueCard
              kanji="正義"
              title="Justice"
              description="Make fair decisions that serve the greater good"
            />
          </div>
        </div>
      </section>

      {/* Plugin Categories */}
      <section id="plugins" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Plugin Categories
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto">
            Organized around Japanese martial arts philosophy
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <CategoryCard
              icon="🎯"
              title="Bushido"
              subtitle="武士道"
              description="Core principles, enforcement hooks, and foundational quality skills"
            />
            <CategoryCard
              icon="⚔️"
              title="Buki"
              subtitle="武器 - Weapons"
              description="Language and tool skills with validation hooks for quality"
            />
            <CategoryCard
              icon="🛤️"
              title="Dō"
              subtitle="道 - The Way"
              description="Specialized agents for development disciplines and practices"
            />
            <CategoryCard
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
          <div className="grid md:grid-cols-3 gap-8">
            <InstallMethodCard
              number="1"
              title="Automatic Installation"
              description="Use the han CLI tool to automatically detect and install appropriate plugins"
              code="npx @thebushidocollective/han install"
            />
            <InstallMethodCard
              number="2"
              title="Via /plugin Command"
              description="Use Claude Code's built-in plugin command"
              code="/plugin add-marketplace han github:thebushidocollective/han"
            />
            <InstallMethodCard
              number="3"
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
      <section className="py-24">
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
                "Learn the seven virtues with bushido",
                "Choose your primary discipline (one Dō)",
                "Master one weapon first (one Buki)"
              ]}
            />
            <PathCard
              title="Ha - 破"
              subtitle="Intermediate Path"
              items={[
                "Practice several disciplines (multiple Dō)",
                "Expand your arsenal (multiple Buki)",
                "Seek wisdom from teachers (Sensei)"
              ]}
            />
            <PathCard
              title="Ri - 離"
              subtitle="Advanced Path"
              items={[
                "Master multiple ways (all Dō)",
                "Contribute new weapons (create Buki)",
                "Share wisdom with others (become Sensei)"
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
                Built by The Bushido Collective - developers committed to honor, quality, and continuous improvement.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Links</h3>
              <ul className="space-y-2">
                <li><a href="https://github.com/thebushidocollective/han" className="text-gray-400 hover:text-white">GitHub</a></li>
                <li><a href="https://github.com/thebushidocollective/han/blob/main/CONTRIBUTING.md" className="text-gray-400 hover:text-white">Contributing</a></li>
                <li><a href="https://thebushido.co" className="text-gray-400 hover:text-white">The Bushido Collective</a></li>
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
            <p>MIT License - Walk the way of bushido. Practice with discipline. Build with honor.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function VirtueCard({ kanji, title, description }: { kanji: string; title: string; description: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg hover:shadow-lg transition">
      <div className="text-4xl mb-3 text-center">{kanji}</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300 text-center">{description}</p>
    </div>
  )
}

function CategoryCard({ icon, title, subtitle, description }: { icon: string; title: string; subtitle: string; description: string }) {
  return (
    <div className="bg-white dark:bg-gray-700 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-gray-900 dark:hover:border-gray-400 transition">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{subtitle}</p>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  )
}

function InstallMethodCard({ number, title, description, code }: { number: string; title: string; description: string; code: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full flex items-center justify-center font-bold mr-3">
          {number}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>
      <pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function PathCard({ title, subtitle, items }: { title: string; subtitle: string; items: string[] }) {
  return (
    <div className="bg-white dark:bg-gray-700 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{subtitle}</p>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start">
            <span className="text-gray-900 dark:text-white mr-2">•</span>
            <span className="text-gray-700 dark:text-gray-300">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
