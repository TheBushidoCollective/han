import type { Metadata } from "next";
import Header from "../components/Header";

export const metadata: Metadata = {
	title: "Documentation - Han",
	description:
		"Complete documentation for Han - automatic quality gates for Claude Code with linting, formatting, type-checking, and testing.",
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
								href="#what-is-han"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								What is Han?
							</a>
							<a
								href="#plugin-categories"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Plugin Categories
							</a>
							<a
								href="#installation"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Installation
							</a>
							<a
								href="#installing-plugins"
								className="block py-2 px-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ml-3"
							>
								Installing Plugins
							</a>
							<a
								href="#installation-scopes"
								className="block py-2 px-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ml-3"
							>
								Installation Scopes
							</a>
							<a
								href="#hook-caching"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Smart Caching
							</a>
							<a
								href="#configuration"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Configuration
							</a>
							<a
								href="#mcp-server"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								MCP Integrations
							</a>
							<a
								href="#metrics"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Metrics
							</a>
							<a
								href="#cli-reference"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								CLI Reference
							</a>
							<a
								href="#cli-plugin"
								className="block py-2 px-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ml-3"
							>
								Plugin Commands
							</a>
							<a
								href="#cli-hook"
								className="block py-2 px-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ml-3"
							>
								Hook Commands
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

						{/* What is Han? */}
						<section id="what-is-han" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								What is Han?
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
								Han is a plugin system for Claude Code that adds automatic
								quality gates. When you write code with Claude, Han validates it
								with real tools: linters, formatters, type checkers, and test
								runners.
							</p>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-8">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									How It Works
								</h3>
								<div className="grid md:grid-cols-4 gap-4">
									<div className="text-center">
										<div className="text-2xl font-bold text-blue-500 mb-2">
											1
										</div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											Install plugins that match your stack
										</p>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-blue-500 mb-2">
											2
										</div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											Write code with Claude as usual
										</p>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-blue-500 mb-2">
											3
										</div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											Hooks run validation automatically on Stop
										</p>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-blue-500 mb-2">
											4
										</div>
										<p className="text-sm text-gray-600 dark:text-gray-300">
											Issues get fixed before you ship
										</p>
									</div>
								</div>
							</div>

							<div className="grid md:grid-cols-2 gap-6 mb-8">
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										Automatic Validation
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										Hooks run when Claude finishes a task. ESLint, Prettier,
										TypeScript, Biome, and more catch issues before you commit.
										If something fails, Claude sees the error and fixes it.
									</p>
								</div>
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										Smart Caching
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										Hooks only run when relevant files change. No redundant
										validation. Fast feedback without waiting for checks that
										already passed.
									</p>
								</div>
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										100% Local and Private
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										All data stays on your machine. Metrics, caches, and
										configurations are stored locally. Nothing is sent to
										external servers.
									</p>
								</div>
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										Zero Config
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										Run{" "}
										<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
											han plugin install --auto
										</code>{" "}
										and Han detects your stack. Plugins come pre-configured with
										sensible defaults.
									</p>
								</div>
							</div>

							<div className="bg-gray-900 dark:bg-gray-950 text-white p-6 rounded-lg">
								<p className="text-lg font-medium mb-2">
									AI generates. Real tools verify. You ship with confidence.
								</p>
								<p className="text-gray-400 text-sm">
									Han plugins are not just prompts. They include validation
									hooks that run your actual linters, formatters, and test
									runners. No hallucinations slip through.
								</p>
							</div>
						</section>

						{/* Plugin Categories */}
						<section id="plugin-categories" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								Plugin Categories
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Han has four types of plugins, each serving a different purpose.
							</p>

							<div className="space-y-6">
								<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
									<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
										Core
									</h3>
									<p className="text-gray-600 dark:text-gray-300 mb-3">
										Foundation plugin with software engineering principles,
										quality commands, and the metrics system. Installed
										automatically with every setup.
									</p>
								</div>

								<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
									<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
										Dō (Discipline)
									</h3>
									<p className="text-gray-600 dark:text-gray-300 mb-3">
										Specialized agents for complex domains. Accessibility
										engineering, frontend development, technical writing. These
										add expert knowledge and workflows for specific disciplines.
									</p>
								</div>

								<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
									<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
										Jutsu (Technique)
									</h3>
									<p className="text-gray-600 dark:text-gray-300 mb-3">
										Technology-specific plugins with validation hooks.
										TypeScript, Biome, ESLint, Playwright, Elixir, and more.
										These run your actual tools to enforce quality standards.
									</p>
								</div>

								<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
									<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
										Hashi (Bridge)
									</h3>
									<p className="text-gray-600 dark:text-gray-300 mb-3">
										MCP server integrations for external services. GitHub,
										Figma, Sentry, Playwright browser automation. Connect Claude
										to tools outside your codebase.
									</p>
								</div>
							</div>
						</section>

						{/* Installation Methods */}
						<section id="installation" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								Installation Methods
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Install the han binary locally for fast hook execution.
							</p>

							<div className="space-y-6">
								<InstallMethod
									title="curl (Recommended)"
									description="Install the han binary to ~/.local/bin"
									code={`curl -fsSL https://han.guru/install.sh | bash

# Then install plugins
han plugin install --auto`}
								/>
								<InstallMethod
									title="Homebrew"
									description="Install via Homebrew on macOS/Linux"
									code={`brew install thebushidocollective/tap/han

# Then install plugins
han plugin install --auto`}
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
han plugin install --auto

# Install to project settings (shared via git)
han plugin install --auto --scope project`}
								/>
								<InstallMethod
									title="Manual Plugin Install"
									description="Install specific plugins by name"
									code="han plugin install jutsu-typescript"
								/>
							</div>
						</section>

						{/* Installation Scopes */}
						<section id="installation-scopes" className="scroll-mt-8 mb-16">
							<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
								Installation Scopes
							</h3>
							<p className="text-gray-600 dark:text-gray-300 mb-6">
								Han supports three installation scopes, representing phases of
								trust as you adopt plugins:
							</p>

							<div className="space-y-6 mb-8">
								{/* Phase 1: User */}
								<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-blue-500">
									<div className="flex items-start gap-4">
										<div className="text-2xl font-bold text-blue-500 shrink-0">
											1
										</div>
										<div className="flex-1">
											<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
												User Scope{" "}
												<span className="text-sm font-normal text-gray-500 dark:text-gray-400">
													(default)
												</span>
											</h4>
											<p className="text-gray-600 dark:text-gray-300 mb-3">
												Install for yourself only. Perfect for trying out
												plugins or using tools across all your projects.
											</p>
											<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-3 rounded overflow-x-auto text-sm">
												<code>han plugin install hashi-playwright-mcp</code>
											</pre>
											<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
												Installs to{" "}
												<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
													~/.claude/settings.json
												</code>
											</p>
										</div>
									</div>
								</div>

								{/* Phase 2: Local */}
								<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-amber-500">
									<div className="flex items-start gap-4">
										<div className="text-2xl font-bold text-amber-500 shrink-0">
											2
										</div>
										<div className="flex-1">
											<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
												Local Scope
											</h4>
											<p className="text-gray-600 dark:text-gray-300 mb-3">
												Project-specific but personal. Use when you want more
												control over a specific project without affecting your
												team.
											</p>
											<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-3 rounded overflow-x-auto text-sm">
												<code>
													han plugin install jutsu-typescript --scope local
												</code>
											</pre>
											<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
												Installs to{" "}
												<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
													.claude/settings.local.json
												</code>{" "}
												(gitignored)
											</p>
										</div>
									</div>
								</div>

								{/* Phase 3: Project */}
								<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-green-500">
									<div className="flex items-start gap-4">
										<div className="text-2xl font-bold text-green-500 shrink-0">
											3
										</div>
										<div className="flex-1">
											<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
												Project Scope
											</h4>
											<p className="text-gray-600 dark:text-gray-300 mb-3">
												Align your team. Committed to git so everyone on the
												project uses the same plugins and validation hooks.
											</p>
											<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-3 rounded overflow-x-auto text-sm">
												<code>han plugin install --auto --scope project</code>
											</pre>
											<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
												Installs to{" "}
												<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
													.claude/settings.json
												</code>{" "}
												(committed to git)
											</p>
										</div>
									</div>
								</div>
							</div>

							<div className="bg-gray-900 dark:bg-gray-950 text-white p-6 rounded-lg">
								<p className="text-lg font-medium mb-2">
									Start personal, grow to team alignment
								</p>
								<p className="text-gray-400 text-sm">
									Try plugins in user scope first. When you find ones that work,
									move to local for project-specific customization. When
									you&apos;re confident, align your team with project scope.
								</p>
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
      "command": "npx -y biome check --write",
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

						{/* MCP Server */}
						<section id="mcp-server" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								MCP Integrations
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Han uses MCP (Model Context Protocol) servers to give Claude
								access to external tools and services. There are two types of
								MCP integrations.
							</p>

							{/* Han MCP Server */}
							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-8">
								<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
									Han MCP Server (hashi-han)
								</h3>
								<p className="text-gray-600 dark:text-gray-300 mb-4">
									Exposes all your installed plugin hooks as MCP tools. Claude
									can run linters, tests, and formatters using natural language
									instead of remembering exact commands.
								</p>

								<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm mb-4">
									<code>han plugin install hashi-han</code>
								</pre>

								<div className="grid md:grid-cols-2 gap-4 mb-4">
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
											Dynamic Tools
										</h4>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Tools are generated from your installed plugins.
											jutsu-typescript adds{" "}
											<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
												jutsu_typescript_typecheck
											</code>
											, jutsu-biome adds{" "}
											<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
												jutsu_biome_lint
											</code>
											, etc.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
											Natural Language
										</h4>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Say &quot;run the tests&quot; or &quot;check types&quot;
											and Claude calls the right tool. No need to remember exact
											hook names or commands.
										</p>
									</div>
								</div>

								<p className="text-sm text-gray-500 dark:text-gray-400">
									Tools include smart caching by default. They only run when
									relevant files have changed.
								</p>
							</div>

							{/* External MCP Servers */}
							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
								<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
									External Service Bridges (hashi-* plugins)
								</h3>
								<p className="text-gray-600 dark:text-gray-300 mb-4">
									Connect Claude to external services via MCP. These plugins
									configure MCP servers that give Claude access to tools outside
									your codebase.
								</p>

								<div className="space-y-4">
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-center gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">
												hashi-github
											</code>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											GitHub API access. Create issues, review PRs, search code,
											manage branches. Claude can interact with your
											repositories directly.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-center gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">
												hashi-playwright-mcp
											</code>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Browser automation. Navigate pages, click elements, fill
											forms, take screenshots. Claude can test and debug web UIs
											visually.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-center gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">
												hashi-figma
											</code>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Figma design access. Extract design tokens, analyze
											frames, generate code from designs. Requires Figma Desktop
											MCP server.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-center gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">
												hashi-sentry
											</code>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Error tracking access. View errors, analyze stack traces,
											check release health. Claude can debug production issues
											with real error data.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-center gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">
												hashi-blueprints
											</code>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Technical documentation system. Create and maintain
											architectural blueprints that stay in sync with your code.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-center gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm">
												hashi-context7
											</code>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Library documentation lookup. Get up-to-date docs for npm
											packages, frameworks, and APIs directly in your session.
										</p>
									</div>
								</div>
							</div>
						</section>

						{/* Metrics */}
						<section id="metrics" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								Local Metrics
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Track how well Claude performs on your tasks. Metrics are stored
								locally on your machine and help identify patterns in success
								rates and common failure points.
							</p>

							<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg mb-8">
								<h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
									100% Private
								</h3>
								<ul className="space-y-2 text-green-700 dark:text-green-300 text-sm">
									<li className="flex items-start gap-2">
										<span className="mt-0.5">✓</span>
										<span>All data stored locally in JSONL files</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="mt-0.5">✓</span>
										<span>No network calls or external services</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="mt-0.5">✓</span>
										<span>You own your data, delete it anytime</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="mt-0.5">✓</span>
										<span>Only task metadata, never conversation content</span>
									</li>
								</ul>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									How It Works
								</h3>
								<div className="space-y-4">
									<div>
										<h4 className="font-medium text-gray-900 dark:text-white mb-2">
											1. Claude tracks tasks
										</h4>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											When working on features or fixes, Claude logs task type,
											estimated complexity, and confidence level using MCP
											tools.
										</p>
									</div>
									<div>
										<h4 className="font-medium text-gray-900 dark:text-white mb-2">
											2. Hooks validate outcomes
										</h4>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Stop hooks run linters, tests, and type checks. Results
											are compared against Claude&apos;s confidence to measure
											calibration accuracy.
										</p>
									</div>
									<div>
										<h4 className="font-medium text-gray-900 dark:text-white mb-2">
											3. Patterns emerge
										</h4>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Over time, metrics show which task types succeed most,
											which hooks fail often, and whether Claude is
											overconfident or underconfident.
										</p>
									</div>
								</div>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									What Gets Tracked
								</h3>
								<div className="grid md:grid-cols-2 gap-4">
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Success Rate
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Overall and per-type (fix, refactor, implementation)
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Calibration
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Confidence vs actual outcomes
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Hook Failures
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Which validation hooks fail most often
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Sessions
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Task counts and patterns over time
										</span>
									</div>
								</div>
							</div>
						</section>

						{/* CLI Reference */}
						<section id="cli-reference" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								CLI Reference
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Complete reference for all{" "}
								<code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
									han
								</code>{" "}
								CLI commands. Use{" "}
								<code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
									han
								</code>{" "}
								to run any command without installation.
							</p>

							{/* Plugin Commands */}
							<div id="cli-plugin" className="mb-12 scroll-mt-8">
								<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
									Plugin Commands
								</h3>

								<div className="space-y-6">
									<CommandDoc
										command="plugin install"
										description="Install plugins interactively or automatically"
										usage="han plugin install [plugin-names...] [options]"
										options={[
											{
												name: "--auto",
												desc: "Analyze codebase and recommend plugins",
											},
											{
												name: "--scope <user|local|project>",
												desc: "Installation scope (default: user)",
											},
										]}
										examples={[
											{
												desc: "Interactive mode",
												code: "han plugin install",
											},
											{
												desc: "Auto-detect plugins",
												code: "han plugin install --auto",
											},
											{
												desc: "Install specific plugin",
												code: "han plugin install jutsu-typescript",
											},
											{
												desc: "Install to project scope",
												code: "han plugin install --auto --scope project",
											},
										]}
									/>

									<CommandDoc
										command="plugin uninstall"
										description="Remove installed plugins"
										usage="han plugin uninstall <plugin-names...> [options]"
										options={[
											{
												name: "--scope <user|local|project>",
												desc: "Scope to uninstall from",
											},
										]}
										examples={[
											{
												desc: "Uninstall a plugin",
												code: "han plugin uninstall jutsu-eslint",
											},
										]}
									/>

									<CommandDoc
										command="plugin search"
										description="Search for plugins in the Han marketplace"
										usage="han plugin search [query]"
										examples={[
											{
												desc: "Search for TypeScript plugins",
												code: "han plugin search typescript",
											},
											{
												desc: "Browse all plugins",
												code: "han plugin search",
											},
										]}
									/>
								</div>
							</div>

							{/* Hook Commands */}
							<div id="cli-hook" className="mb-12 scroll-mt-8">
								<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
									Hook Commands
								</h3>

								<div className="space-y-6">
									<CommandDoc
										command="hook run"
										description="Run a hook command defined by a plugin"
										usage="han hook run <plugin-name> <hook-name> [options]"
										options={[
											{
												name: "--fail-fast",
												desc: "Stop on first failure (default: true)",
											},
											{
												name: "--cached",
												desc: "Skip if no relevant files changed since last successful run",
											},
											{
												name: "--only=<dir>",
												desc: "Only run in the specified directory",
											},
											{
												name: "--verbose",
												desc: "Show full command output",
											},
										]}
										examples={[
											{
												desc: "Run TypeScript type checking",
												code: "han hook run jutsu-typescript typecheck",
											},
											{
												desc: "Run with caching",
												code: "han hook run jutsu-elixir test --cached",
											},
											{
												desc: "Run in specific directory",
												code: "han hook run jutsu-biome lint --only=packages/core",
											},
										]}
									/>

									<CommandDoc
										command="hook explain"
										description="Show comprehensive information about configured hooks"
										usage="han hook explain [hookType] [options]"
										options={[
											{
												name: "[hookType]",
												desc: "Filter by hook type (e.g., Stop, SessionStart)",
											},
											{
												name: "--all",
												desc: "Include hooks from Claude Code settings (not just Han plugins)",
											},
										]}
										examples={[
											{
												desc: "Show all Han plugin hooks",
												code: "han hook explain",
											},
											{
												desc: "Show only Stop hooks",
												code: "han hook explain Stop",
											},
											{
												desc: "Show all hooks including settings",
												code: "han hook explain --all",
											},
										]}
									/>

									<CommandDoc
										command="hook dispatch"
										description="Dispatch hooks of a specific type across all installed Han plugins"
										usage="han hook dispatch <hookType> [options]"
										options={[
											{
												name: "--all",
												desc: "Include hooks from Claude Code settings",
											},
										]}
										examples={[
											{
												desc: "Dispatch SessionStart hooks",
												code: "han hook dispatch SessionStart",
											},
											{
												desc: "Dispatch Stop hooks including settings",
												code: "han hook dispatch Stop --all",
											},
										]}
									/>

									<CommandDoc
										command="hook test"
										description="Validate hook configurations for all installed plugins"
										usage="han hook test [options]"
										options={[
											{
												name: "--execute",
												desc: "Actually execute hooks to verify they run successfully",
											},
										]}
										examples={[
											{
												desc: "Validate hook structure",
												code: "han hook test",
											},
											{
												desc: "Validate and execute hooks",
												code: "han hook test --execute",
											},
										]}
									/>
								</div>
							</div>

							{/* Other Commands */}
							<div className="mb-12">
								<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
									Other Commands
								</h3>

								<div className="space-y-6">
									<CommandDoc
										command="mcp"
										description="Start the Han MCP server for natural language hook execution"
										usage="han mcp"
										examples={[
											{
												desc: "Start MCP server",
												code: "han mcp",
											},
										]}
									/>

									<CommandDoc
										command="uninstall"
										description="Remove all Han plugins and marketplace configuration"
										usage="han uninstall"
										examples={[
											{
												desc: "Remove Han completely",
												code: "han uninstall",
											},
										]}
									/>
								</div>
							</div>
						</section>
					</main>
				</div>
			</div>

			{/* Footer */}
			<footer className="bg-gray-900 dark:bg-gray-950 text-white py-12 mt-16">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center text-gray-400">
						<p>MIT License</p>
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

function CommandDoc({
	command,
	description,
	usage,
	options,
	examples,
}: {
	command: string;
	description: string;
	usage: string;
	options?: { name: string; desc: string }[];
	examples: { desc: string; code: string }[];
}) {
	return (
		<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
			<h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
				{command}
			</h4>
			<p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>

			<div className="mb-4">
				<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
					Usage
				</p>
				<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-3 rounded overflow-x-auto text-sm">
					<code>{usage}</code>
				</pre>
			</div>

			{options && options.length > 0 && (
				<div className="mb-4">
					<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
						Options
					</p>
					<ul className="space-y-1 text-sm">
						{options.map((opt) => (
							<li key={opt.name} className="flex items-start gap-2">
								<code className="bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded shrink-0">
									{opt.name}
								</code>
								<span className="text-gray-600 dark:text-gray-300">
									{opt.desc}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div>
				<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
					Examples
				</p>
				<div className="space-y-2">
					{examples.map((ex) => (
						<div key={ex.code}>
							<p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
								{ex.desc}
							</p>
							<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto text-xs">
								<code>{ex.code}</code>
							</pre>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
