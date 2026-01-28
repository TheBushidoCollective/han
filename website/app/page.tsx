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
						href="#getting-started"
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

			{/* AI-DLC Callout */}
			<section className="bg-gradient-to-r from-blue-600 to-indigo-700 py-12">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
					<p className="text-blue-100 text-sm font-medium uppercase tracking-wide mb-2">
						New Paper
					</p>
					<h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
						You didn&apos;t fail at AI.
						<br />
						<span className="text-blue-200">
							You just handed it a human&apos;s job description.
						</span>
					</h2>
					<p className="text-blue-100 mb-6 max-w-2xl mx-auto">
						AI-DLC 2026 is a methodology for AI-driven development that actually
						works. Learn how to write completion criteria, choose operating
						modes, and let AI iterate autonomously.
					</p>
					<Link
						href="/papers/ai-dlc-2026"
						className="inline-flex items-center px-6 py-3 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition"
					>
						Read the Paper
						<svg
							className="ml-2 w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 5l7 7-7 7"
							/>
						</svg>
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
						139 plugins across four categories, all working together.
					</p>

					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
						<CategoryCard
							href="/plugins/core"
							icon="⛩️"
							title="Core"
							subtitle="Foundation"
							count="2"
							description="Essential infrastructure. Auto-installs han binary, provides metrics, MCP servers, and quality principles."
						/>
						<CategoryCard
							href="/plugins/do"
							icon="🛤️"
							title="Dō"
							subtitle="Agents"
							count="25+"
							description="Specialized AI agents for code review, debugging, architecture, and security."
						/>
						<CategoryCard
							href="/plugins/jutsu"
							icon="🎯"
							title="Jutsu"
							subtitle="Tools"
							count="100+"
							description="Validation plugins for your stack. TypeScript, Biome, Pytest, ShellCheck, and more."
						/>
						<CategoryCard
							href="/plugins/hashi"
							icon="🌉"
							title="Hashi"
							subtitle="Integrations"
							count="10+"
							description="MCP servers connecting Claude to GitHub, Jira, Sentry, and other tools."
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

			{/* Getting Started */}
			<section id="getting-started" className="py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						Getting Started
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
						Two commands. That&apos;s it.
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
	count,
	description,
}: {
	href: string;
	icon: string;
	title: string;
	subtitle: string;
	count: string;
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
					<p className="text-sm text-gray-500 dark:text-gray-400">
						{subtitle} · {count}
					</p>
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
