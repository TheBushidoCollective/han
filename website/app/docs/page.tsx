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
								href="#philosophy"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								The Three Pillars
							</a>
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
								href="#installation-scopes"
								className="block py-2 px-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md ml-3"
							>
								Installation Scopes
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
							<a
								href="#mcp-server"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								MCP Server
							</a>
							<a
								href="#metrics"
								className="block py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
							>
								Agent Metrics
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

						{/* Philosophy - The Three Pillars */}
						<section id="philosophy" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								The Three Pillars
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">
								Han plugins are not just prompts or skills. They are complete
								mastery systems. Every plugin is built on three foundational
								pillars that work together to ensure not just capability, but
								excellence.
							</p>

							<div className="space-y-8 mb-12">
								{/* Knowledge Pillar */}
								<div className="bg-gray-50 dark:bg-gray-700 p-8 rounded-lg">
									<div className="flex items-start gap-6">
										<div className="text-center shrink-0">
											<span className="text-5xl font-bold text-gray-900 dark:text-white">
												知
											</span>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
												Chi
											</p>
										</div>
										<div>
											<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
												Knowledge
											</h3>
											<p className="text-gray-600 dark:text-gray-300 mb-4">
												Deep expertise distilled into skills and patterns. Not
												just answers, but understanding: the wisdom to know why,
												not just how. Each skill contains hundreds of lines of
												carefully crafted guidance, best practices, and
												real-world examples.
											</p>
											<div className="grid md:grid-cols-2 gap-4">
												<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
													<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
														Skills
													</h4>
													<p className="text-sm text-gray-600 dark:text-gray-300">
														Framework-specific expertise loaded on-demand.
														TypeScript patterns, React hooks, testing
														strategies. Deep knowledge when you need it.
													</p>
												</div>
												<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
													<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
														Anti-Patterns
													</h4>
													<p className="text-sm text-gray-600 dark:text-gray-300">
														Learn what to avoid, not just what to do. Common
														pitfalls, security vulnerabilities, and performance
														traps identified before they become problems.
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Action Pillar */}
								<div className="bg-gray-50 dark:bg-gray-700 p-8 rounded-lg">
									<div className="flex items-start gap-6">
										<div className="text-center shrink-0">
											<span className="text-5xl font-bold text-gray-900 dark:text-white">
												行
											</span>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
												Kō
											</p>
										</div>
										<div>
											<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
												Action
											</h3>
											<p className="text-gray-600 dark:text-gray-300 mb-4">
												Specialized agents and commands that execute with
												precision. From code review to refactoring, automated
												workflows that embody expertise. Knowledge becomes
												action through purpose-built automation.
											</p>
											<div className="grid md:grid-cols-2 gap-4">
												<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
													<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
														Agents
													</h4>
													<p className="text-sm text-gray-600 dark:text-gray-300">
														Specialized subagents for complex tasks. Frontend
														development, accessibility engineering,
														documentation. Each with deep domain expertise.
													</p>
												</div>
												<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
													<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
														Commands
													</h4>
													<p className="text-sm text-gray-600 dark:text-gray-300">
														Slash commands for common workflows. Code review,
														debugging, refactoring. Complex multi-step processes
														simplified to a single invocation.
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>

								{/* Discipline Pillar */}
								<div className="bg-gray-50 dark:bg-gray-700 p-8 rounded-lg">
									<div className="flex items-start gap-6">
										<div className="text-center shrink-0">
											<span className="text-5xl font-bold text-gray-900 dark:text-white">
												律
											</span>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
												Ritsu
											</p>
										</div>
										<div>
											<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
												Discipline
											</h3>
											<p className="text-gray-600 dark:text-gray-300 mb-4">
												Validation hooks that enforce quality automatically.
												Every change verified, every standard upheld. Excellence
												through enforcement. This is what separates Han plugins
												from simple prompt collections.
											</p>
											<div className="grid md:grid-cols-2 gap-4">
												<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
													<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
														Validation Hooks
													</h4>
													<p className="text-sm text-gray-600 dark:text-gray-300">
														Automatic quality gates that run on every change.
														Linting, formatting, type checking. Enforced
														consistently without manual intervention.
													</p>
												</div>
												<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
													<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
														Smart Caching
													</h4>
													<p className="text-sm text-gray-600 dark:text-gray-300">
														Intelligent change detection ensures hooks only run
														when needed. Fast feedback without redundant
														validation. Discipline without delay.
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div className="bg-gray-900 dark:bg-gray-950 text-white p-8 rounded-lg">
								<p className="text-2xl font-medium mb-4">
									AI capability + Real verification = Shipping with confidence
								</p>
								<p className="text-gray-400">
									When you install a Han plugin, you&apos;re not just getting
									prompts. You&apos;re getting a complete system that teaches,
									executes, and validates. The AI generates, real tools verify,
									and you ship with confidence. No hallucinations slip through.
								</p>
							</div>
						</section>

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
												<code>
													npx @thebushidocollective/han plugin install
													hashi-playwright-mcp
												</code>
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
													npx @thebushidocollective/han plugin install
													jutsu-typescript --scope local
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
												<code>
													npx @thebushidocollective/han plugin install --auto
													--scope project
												</code>
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
								MCP Server
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Run hook commands via natural language. The Han MCP server
								dynamically exposes tools based on your installed plugins,
								letting you say &quot;run the elixir tests&quot; instead of
								remembering exact commands.
							</p>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Quick Start
								</h3>
								<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
									<code>
										npx @thebushidocollective/han plugin install hashi-han
									</code>
								</pre>
								<p className="text-gray-600 dark:text-gray-300 mt-4 text-sm">
									Once installed, the MCP server automatically discovers your
									installed plugins and exposes their hooks as tools.
								</p>
							</div>

							<div className="grid md:grid-cols-2 gap-6 mb-8">
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										Dynamic Tool Discovery
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										Tools are generated based on what plugins you have
										installed. Install jutsu-elixir and get{" "}
										<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
											jutsu_elixir_test
										</code>
										,{" "}
										<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
											jutsu_elixir_lint
										</code>
										, etc.
									</p>
								</div>
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										Smart Caching Built-in
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										All the benefits of hook caching apply to MCP tool calls.
										Only runs when files have changed. Fast feedback without
										redundant validation.
									</p>
								</div>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Example Tools Generated
								</h3>
								<div className="space-y-3">
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											jutsu_elixir_test
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Run tests for elixir (in directories with mix.exs) - runs:{" "}
											<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
												mix test --stale
											</code>
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											jutsu_typescript_typecheck
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Run type checking for typescript (in directories with
											tsconfig.json) - runs:{" "}
											<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
												npx -y --package typescript tsc
											</code>
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											jutsu_biome_lint
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Run linter for biome projects - runs:{" "}
											<code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">
												npx biome check
											</code>
										</span>
									</div>
								</div>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Tool Parameters
								</h3>
								<ul className="space-y-3 text-gray-600 dark:text-gray-300">
									<li className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											verbose
										</code>
										<span>Show full command output (default: false)</span>
									</li>
									<li className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											failFast
										</code>
										<span>
											Stop on first failure when running in multiple directories
											(default: true)
										</span>
									</li>
									<li className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											directory
										</code>
										<span>
											Run only in this specific directory (relative to project
											root)
										</span>
									</li>
								</ul>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mt-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									External MCP Integrations
								</h3>
								<p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
									Han also provides hashi plugins that connect to external MCP
									servers, bridging Claude Code with external services and
									tools.
								</p>
								<div className="space-y-4">
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-start gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
												hashi-figma
											</code>
											<span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
												Design Phase
											</span>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Figma integration for design-to-code generation, design
											token extraction, component sync, and frame analysis.
											Connects to Figma Desktop MCP server via HTTP.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-start gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
												hashi-sentry
											</code>
											<span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
												Deploy & Maintain Phase
											</span>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Sentry integration for error tracking, performance
											monitoring, release health, and incident response with
											Seer AI root cause analysis. Remote HTTP OAuth server.
										</p>
									</div>
									<div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
										<div className="flex items-start gap-3 mb-2">
											<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
												hashi-han-metrics
											</code>
											<span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
												Quality Measurement
											</span>
										</div>
										<p className="text-gray-600 dark:text-gray-300 text-sm">
											Agent performance tracking with self-reporting, objective
											validation, and calibration metrics. Local SQLite storage
											with SessionStart/Stop hooks for continuous improvement.
										</p>
									</div>
								</div>
							</div>
						</section>

						{/* Agent Metrics */}
						<section id="metrics" className="scroll-mt-8 mb-16">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
								Agent Metrics
							</h2>
							<p className="text-gray-600 dark:text-gray-300 mb-8">
								Track agent performance with self-reporting and objective
								validation. The metrics system creates a feedback loop for
								continuous improvement in success rates and calibration
								accuracy.
							</p>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Quick Start
								</h3>
								<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
									<code>
										npx @thebushidocollective/han plugin install
										hashi-han-metrics
									</code>
								</pre>
								<p className="text-gray-600 dark:text-gray-300 mt-4 text-sm">
									Once installed, agents automatically track their work using
									MCP tools and hooks validate outcomes against objective
									signals.
								</p>
							</div>

							<div className="grid md:grid-cols-2 gap-6 mb-8">
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										Self-Reporting Agents
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										Agents use MCP tools to track tasks: start_task,
										update_task, complete_task with confidence levels (0-1).
										This builds self-awareness of performance patterns.
									</p>
								</div>
								<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
									<h4 className="font-semibold text-gray-900 dark:text-white mb-3">
										Objective Validation
									</h4>
									<p className="text-gray-600 dark:text-gray-300 text-sm">
										Stop hooks cross-validate self-assessments with quality
										checks (tests, lints, types). Calculates calibration
										accuracy to identify overconfidence or underconfidence.
									</p>
								</div>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Key Metrics
								</h3>
								<div className="space-y-3">
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Success Rate
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Overall and per-type success rates (implementation, fix,
											refactor, research)
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Calibration Score
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											How well agent confidence matches actual outcomes (perfect
											= 0.0)
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Duration
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Average task duration by type and complexity
										</span>
									</div>
									<div className="flex items-start gap-3">
										<code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-sm shrink-0">
											Confidence Buckets
										</code>
										<span className="text-gray-600 dark:text-gray-300 text-sm">
											Breakdown of confidence levels vs actual success to spot
											patterns
										</span>
									</div>
								</div>
							</div>

							<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
									Privacy & Storage
								</h3>
								<ul className="space-y-2 text-gray-600 dark:text-gray-300 text-sm">
									<li className="flex items-start gap-2">
										<span className="text-green-500 dark:text-green-400 mt-0.5">
											✓
										</span>
										<span>
											100% local - all data in SQLite at ~/.claude/metrics/
										</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-green-500 dark:text-green-400 mt-0.5">
											✓
										</span>
										<span>No network calls or external services</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-green-500 dark:text-green-400 mt-0.5">
											✓
										</span>
										<span>
											User-owned data - query, backup, or delete anytime
										</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-green-500 dark:text-green-400 mt-0.5">
											✓
										</span>
										<span>
											Minimal data - task descriptions, outcomes, no
											conversations
										</span>
									</li>
								</ul>
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
									npx @thebushidocollective/han
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
												code: "npx @thebushidocollective/han plugin install",
											},
											{
												desc: "Auto-detect plugins",
												code: "npx @thebushidocollective/han plugin install --auto",
											},
											{
												desc: "Install specific plugin",
												code: "npx @thebushidocollective/han plugin install jutsu-typescript",
											},
											{
												desc: "Install to project scope",
												code: "npx @thebushidocollective/han plugin install --auto --scope project",
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
												code: "npx @thebushidocollective/han plugin uninstall jutsu-eslint",
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
												code: "npx @thebushidocollective/han plugin search typescript",
											},
											{
												desc: "Browse all plugins",
												code: "npx @thebushidocollective/han plugin search",
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
												code: "npx @thebushidocollective/han hook run jutsu-typescript typecheck",
											},
											{
												desc: "Run with caching",
												code: "npx @thebushidocollective/han hook run jutsu-elixir test --cached",
											},
											{
												desc: "Run in specific directory",
												code: "npx @thebushidocollective/han hook run jutsu-biome lint --only=packages/core",
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
												code: "npx @thebushidocollective/han hook explain",
											},
											{
												desc: "Show only Stop hooks",
												code: "npx @thebushidocollective/han hook explain Stop",
											},
											{
												desc: "Show all hooks including settings",
												code: "npx @thebushidocollective/han hook explain --all",
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
												code: "npx @thebushidocollective/han hook dispatch SessionStart",
											},
											{
												desc: "Dispatch Stop hooks including settings",
												code: "npx @thebushidocollective/han hook dispatch Stop --all",
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
												code: "npx @thebushidocollective/han hook test",
											},
											{
												desc: "Validate and execute hooks",
												code: "npx @thebushidocollective/han hook test --execute",
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
												code: "npx @thebushidocollective/han mcp",
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
												code: "npx @thebushidocollective/han uninstall",
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
