import type { Metadata } from "next";
import Header from "../components/Header";

export const metadata: Metadata = {
	title: "Documentation - Han",
	description:
		"Complete documentation for Han - installation methods, hook caching, and configuration.",
};

export default function DocsPage() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
			<Header />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex gap-8">
					{/* Sidebar Navigation */}
					<aside className="hidden lg:block w-64 shrink-0">
						<nav className="sticky top-8 space-y-1">
							<p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
								Documentation
							</p>
							<a
								href="#installation"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Installation Methods
							</a>
							<a
								href="#installing-plugins"
								className="block py-2 px-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ml-3"
							>
								Installing Plugins
							</a>
							<a
								href="#hook-caching"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Smart Hook Caching
							</a>
							<a
								href="#configuration"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Configuration
							</a>
						</nav>
					</aside>

					{/* Main Content */}
					<main className="flex-1 min-w-0">
						{/* Hero */}
						<div className="mb-12">
							<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
								Documentation
							</h1>
							<p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl">
								Everything you need to know about installing, configuring, and
								using Han plugins.
							</p>
						</div>

						{/* Installation Methods */}
						<section id="installation" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								Installation Methods
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								No installation required - use npx to install plugins instantly.
								Hooks run automatically via npx.
							</p>

							<div className="space-y-6">
								<InstallMethod
									title="npx (Recommended)"
									description="Use han without installing - npx fetches the latest version"
									code="npx @thebushidocollective/han plugin install --auto"
								/>
								<InstallMethod
									title="Claude Code"
									description="Install plugins directly from within a Claude Code session"
									code={`# First add the Han marketplace
/marketplace add han

# Then install plugins
/plugin install bushido@han`}
								/>
								<InstallMethod
									title="Claude CLI"
									description="Install from the command line with Claude CLI"
									code={`# First add the Han marketplace
claude marketplace add han

# Then install plugins
claude plugin install bushido@han`}
								/>
							</div>
						</section>

						{/* Installing Plugins */}
						<section id="installing-plugins" className="scroll-mt-8 mb-16">
							<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
								Installing Plugins
							</h3>
							<p className="text-gray-600 dark:text-gray-300 mb-6">
								Install plugins using any of these methods:
							</p>
							<div className="space-y-6">
								<InstallMethod
									title="Automatic Detection"
									description="Let han analyze your codebase and recommend plugins"
									code={`# Analyze codebase and recommend plugins
npx @thebushidocollective/han plugin install --auto

# Install to project settings (shared via git)
npx @thebushidocollective/han plugin install --auto --scope project`}
								/>
								<InstallMethod
									title="Manual Plugin Install"
									description="Install specific plugins by name"
									code="npx @thebushidocollective/han plugin install jutsu-typescript"
								/>
							</div>
						</section>

						{/* Smart Hook Caching */}
						<section id="hook-caching" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								Smart Hook Caching
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Plugins use intelligent caching to avoid redundant validation
								runs, saving time by only running hooks when relevant files have
								changed.
							</p>

							<div className="grid md:grid-cols-3 gap-6 mb-8">
								<FeatureCard
									icon="🚀"
									title="Session Start"
									description="Hooks prime the cache by hashing relevant files when your Claude Code session begins"
								/>
								<FeatureCard
									icon="⚡"
									title="Change Detection"
									description="On Stop, hooks only run if files matching their patterns have changed since the last successful run"
								/>
								<FeatureCard
									icon="💾"
									title="Persistent Cache"
									description="Cache is stored per-project and persists across sessions, so unchanged files stay validated"
								/>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									How It Works
								</h3>
								<p className="text-gray-600 dark:text-gray-300 mb-4">
									Each plugin defines{" "}
									<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
										ifChanged
									</code>{" "}
									patterns in its{" "}
									<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
										han-config.json
									</code>
									:
								</p>
								<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
									<code>{`{
  "hooks": {
    "lint": {
      "command": "npx biome check --write",
      "dirsWith": ["biome.json"],
      "ifChanged": ["**/*.{js,jsx,ts,tsx,json}"]
    }
  }
}`}</code>
								</pre>
								<p className="text-gray-600 dark:text-gray-300 mt-4 text-sm">
									The{" "}
									<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
										ifChanged
									</code>{" "}
									patterns determine which files are tracked. If none of those
									files have changed, the hook is skipped entirely.
								</p>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Cache Location
								</h3>
								<p className="text-gray-600 dark:text-gray-300 mb-2">
									Cache manifests are stored at:
								</p>
								<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
									<code>~/.claude/projects/{"{project-slug}"}/han/</code>
								</pre>
							</div>
						</section>

						{/* Configuration */}
						<section id="configuration" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								Configuration
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Override hook behavior per-directory with a{" "}
								<code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
									han-config.yml
								</code>{" "}
								file in your project.
							</p>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Example Configuration
								</h3>
								<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
									<code>{`# han-config.yml in your project directory
jutsu-eslint:
  lint:
    enabled: false  # Disable this hook
    # command: "npm run lint:custom"  # Override command
    # if_changed:  # Add additional file patterns (merged with defaults)
    #   - "custom/**/*.ts"`}</code>
								</pre>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Available Options
								</h3>
								<ul className="space-y-3 text-gray-600 dark:text-gray-300">
									<li className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											enabled
										</code>
										<span>
											Set to{" "}
											<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
												false
											</code>{" "}
											to disable the hook in this directory
										</span>
									</li>
									<li className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											command
										</code>
										<span>Override the command that runs for this hook</span>
									</li>
									<li className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											if_changed
										</code>
										<span>
											Additional glob patterns for change detection (merged with
											plugin defaults)
										</span>
									</li>
								</ul>
							</div>
						</section>
					</main>
				</div>
			</div>

			{/* Footer */}
			<footer className="bg-gray-900 dark:bg-gray-950 text-white py-12 mt-16">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center text-gray-400">
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

function InstallMethod({
	title,
	description,
	code,
}: {
	title: string;
	description: string;
	code: string;
}) {
	return (
		<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
			<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
				{title}
			</h4>
			<p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
				{description}
			</p>
			<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
				<code>{code}</code>
			</pre>
		</div>
	);
}

function FeatureCard({
	icon,
	title,
	description,
}: {
	icon: string;
	title: string;
	description: string;
}) {
	return (
		<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
			<div className="text-4xl mb-3">{icon}</div>
			<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
				{title}
			</h3>
			<p className="text-gray-600 dark:text-gray-300">{description}</p>
		</div>
	);
}
