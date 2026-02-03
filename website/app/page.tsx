import type { Metadata } from "next";
import Link from "next/link";
import Header from "./components/Header";

export const metadata: Metadata = {
	title: "Han - Automatic Quality Gates for Claude Code",
	description:
		"Every Claude Code conversation ends with validation. Linting, formatting, type-checking, and tests run automatically, catching issues before they ship.",
};

export default function Home() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
			<Header />

			{/* Hero */}
			<section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
				<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 leading-tight">
					Automatic Quality Gates for Claude Code
				</h1>
				<p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto px-2">
					Every conversation ends with validation. Linting, formatting,
					type-checking, and tests run automatically, catching issues before
					they ship.
				</p>
				<div className="flex flex-col sm:flex-row gap-4 justify-center">
					<a
						href="#get-plugin"
						className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition"
					>
						Get Started
					</a>
					<Link
						href="/plugins"
						className="px-8 py-3 border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition"
					>
						Browse 139 Plugins
					</Link>
				</div>
			</section>

			{/* How It Works */}
			<section className="bg-white dark:bg-gray-800 py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						How It Works
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto">
						Quality enforcement that runs automatically, learns from results,
						and gets faster over time.
					</p>

					<div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
						<StepCard
							number={1}
							title="Install"
							description="One command installs the CLI and auto-detects plugins for your stack."
							code="han plugin install --auto"
						/>
						<StepCard
							number={2}
							title="Code"
							description="Claude writes code as usual. No workflow changes needed."
						/>
						<StepCard
							number={3}
							title="Validate"
							description="Stop hooks run automatically. Linters, formatters, type checkers, and tests are all verified."
						/>
						<StepCard
							number={4}
							title="Learn"
							description="Local metrics track success rates and calibrate confidence. Nothing leaves your machine."
						/>
					</div>
				</div>
			</section>

			{/* What's Inside */}
			<section id="plugins" className="py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						What&apos;s Inside
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-2xl mx-auto">
						139+ plugins across nine categories, all working together.
					</p>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
						<CategoryCard
							href="/plugins/core"
							icon="⛩️"
							title="Core"
							subtitle="Essential Infrastructure"
							description="Auto-installs han binary, provides metrics, MCP servers, and quality principles."
						/>
						<CategoryCard
							href="/plugins/languages"
							icon="💬"
							title="Languages"
							subtitle="Programming Support"
							description="Language-specific tooling, LSP integration, and syntax support."
						/>
						<CategoryCard
							href="/plugins/frameworks"
							icon="🏗️"
							title="Frameworks"
							subtitle="Framework Integrations"
							description="Framework-specific patterns, components, and best practices."
						/>
						<CategoryCard
							href="/plugins/validation"
							icon="✅"
							title="Validation"
							subtitle="Code Quality"
							description="Linting, formatting, type checking, and quality enforcement."
						/>
						<CategoryCard
							href="/plugins/tools"
							icon="🔧"
							title="Tools"
							subtitle="Development Tools"
							description="Build tools, package managers, testing frameworks, and utilities."
						/>
						<CategoryCard
							href="/plugins/services"
							icon="🌐"
							title="Services"
							subtitle="External Integrations"
							description="MCP servers for GitHub, Jira, Sentry, and other external APIs."
						/>
						<CategoryCard
							href="/plugins/disciplines"
							icon="🎓"
							title="Disciplines"
							subtitle="Specializations"
							description="Specialized agents for frontend, backend, security, and more."
						/>
						<CategoryCard
							href="/plugins/patterns"
							icon="📐"
							title="Patterns"
							subtitle="Methodologies"
							description="Workflows, architectural patterns, and best practices."
						/>
						<CategoryCard
							href="/plugins/specialized"
							icon="🔬"
							title="Specialized"
							subtitle="Niche Tools"
							description="Domain-specific and specialized development tools."
						/>
					</div>

					<div className="mt-12 text-center">
						<Link
							href="/plugins"
							className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
						>
							Browse all plugins →
						</Link>
					</div>
				</div>
			</section>

			{/* Why It Works */}
			<section className="bg-white dark:bg-gray-800 py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-16">
						Why It Works
					</h2>

					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
						<FeatureCard
							icon="⚡"
							title="Smart Caching"
							description="Only runs validation when relevant files change. Native Rust hashing keeps it fast."
						/>
						<FeatureCard
							icon="📊"
							title="Local Metrics"
							description="Tracks task success and confidence calibration. All data stays on your machine, never sent anywhere."
						/>
						<FeatureCard
							icon="🔧"
							title="Zero Config"
							description="Binary auto-installs on first session. --auto flag detects your stack automatically."
						/>
						<FeatureCard
							icon="🔌"
							title="Any Stack"
							description="TypeScript, Python, Rust, Go, Ruby, Elixir. If there's a linter, there's a plugin."
						/>
					</div>
				</div>
			</section>

			{/* Get the Plugin */}
			<section
				id="get-plugin"
				className="py-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800"
			>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						Get Started
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
						Install directly in Claude Code with a few simple commands.
					</p>

					<div className="max-w-3xl mx-auto">
						<div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
							<div className="space-y-6">
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-medium">
										1. Add the Han marketplace:
									</p>
									<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
										<code>
											/plugin marketplace add thebushidocollective/han
										</code>
									</pre>
								</div>

								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-medium">
										2. Install the core plugin:
									</p>
									<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
										<code>/plugin install core@thebushidocollective-han</code>
									</pre>
								</div>

								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-medium">
										3. Install backpressure plugins for your stack:
									</p>
									<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
										<code>
											{`# TypeScript projects
/plugin install typescript@thebushidocollective-han
/plugin install biome@thebushidocollective-han

# Python projects
/plugin install ruff@thebushidocollective-han
/plugin install pytest@thebushidocollective-han`}
										</code>
									</pre>
								</div>
							</div>

							<div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
								<p className="text-sm text-gray-500 dark:text-gray-400 text-center">
									Backpressure plugins provide quality gates that guide AI
									iteration.
									<br />
									Linting, type checking, and test failures create feedback
									loops that improve output.
								</p>
							</div>
						</div>

						<div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
							<div className="p-4">
								<div className="text-2xl mb-2">🎯</div>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Backpressure guides iteration
								</p>
							</div>
							<div className="p-4">
								<div className="text-2xl mb-2">⚡</div>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Smart caching for speed
								</p>
							</div>
							<div className="p-4">
								<div className="text-2xl mb-2">🔒</div>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									All data stays local
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Getting Started (CLI) */}
			<section id="getting-started" className="py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						CLI Installation
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
						Prefer the command line? Install the han CLI for more control.
					</p>

					<div className="max-w-2xl mx-auto">
						<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
							<div className="space-y-6">
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
										1. Install the CLI:
									</p>
									<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
										<code>curl -fsSL https://han.guru/install.sh | bash</code>
									</pre>
								</div>
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
										2. Auto-detect and install plugins for your project:
									</p>
									<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
										<code>han plugin install --auto</code>
									</pre>
								</div>
							</div>
						</div>

						<div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
							<p className="text-sm text-blue-800 dark:text-blue-200">
								<strong>That&apos;s it.</strong> Next time you use Claude Code,
								validation hooks will run automatically when you finish a
								conversation.
							</p>
						</div>

						<div className="mt-6 text-center">
							<Link
								href="/docs"
								className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
							>
								Read the full documentation →
							</Link>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}

function StepCard({
	number,
	title,
	description,
	code,
}: {
	number: number;
	title: string;
	description: string;
	code?: string;
}) {
	return (
		<div className="text-center">
			<div className="w-12 h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
				{number}
			</div>
			<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
				{title}
			</h3>
			<p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
				{description}
			</p>
			{code && (
				<code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
					{code}
				</code>
			)}
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
			<div className="flex items-center gap-3 mb-4">
				<span className="text-3xl">{icon}</span>
				<div>
					<h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200">
						{title}
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
				</div>
			</div>
			<p className="text-gray-600 dark:text-gray-300">{description}</p>
		</Link>
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
		<div className="text-center">
			<div className="text-4xl mb-4">{icon}</div>
			<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
				{title}
			</h3>
			<p className="text-gray-600 dark:text-gray-300 text-sm">{description}</p>
		</div>
	);
}
