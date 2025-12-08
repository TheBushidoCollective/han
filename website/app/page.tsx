import type { Metadata } from "next";
import Link from "next/link";
import { getCategoryIcon } from "../lib/plugins";
import Header from "./components/Header";

export const metadata: Metadata = {
	title: "Han - Sophisticated Claude Code Plugins with Superior Accuracy",
	description:
		"A curated marketplace of Claude Code plugins with quality enforcement, validation hooks, and specialized agents. Master your craft through disciplined practice, quality craftsmanship, and continuous improvement.",
};

export default function Home() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
			<Header />

			{/* Hero */}
			<section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
				<h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
					Sophisticated Claude Code Plugins with Superior Accuracy
				</h1>
				<p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
					A curated marketplace of Claude Code plugins with quality enforcement,
					validation hooks, and specialized agents. Master your craft through
					disciplined practice, quality craftsmanship, and continuous
					improvement.
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

			{/* The Han Difference - Three Pillars */}
			<section className="bg-white dark:bg-gray-800 py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						More Than Just Prompts
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-3xl mx-auto text-lg">
						Every Han plugin is a complete mastery system built on three
						pillars. Not just what to do, but how to do it right, with
						validation that ensures excellence.
					</p>

					<div className="grid md:grid-cols-3 gap-8 lg:gap-12">
						<PillarCard
							kanji="知"
							reading="Chi"
							title="Knowledge"
							description="Deep expertise distilled into skills and patterns. Not just answers, but understanding: the wisdom to know why, not just how."
							features={[
								"Framework-specific best practices",
								"Anti-patterns and pitfalls to avoid",
								"Real-world code examples",
							]}
						/>
						<PillarCard
							kanji="行"
							reading="Kō"
							title="Action"
							description="Specialized agents and commands that execute with precision. From code review to refactoring, automated workflows that embody expertise."
							features={[
								"Purpose-built development agents",
								"Slash commands for common tasks",
								"Multi-step workflow automation",
							]}
						/>
						<PillarCard
							kanji="律"
							reading="Ritsu"
							title="Discipline"
							description="Validation hooks that enforce quality automatically. Every change verified, every standard upheld. Excellence through enforcement."
							features={[
								"Automatic linting and formatting",
								"Pre-commit quality gates",
								"Smart caching for fast feedback",
							]}
						/>
					</div>

					<div className="mt-16 text-center">
						<p className="text-xl text-gray-700 dark:text-gray-200 font-medium">
							AI capability + Real verification = Shipping with confidence
						</p>
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
						Inspired by Japanese samurai traditions
					</p>
					<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
						<CategoryCard
							href="/plugins/core"
							icon={getCategoryIcon("core")}
							title="Core"
							subtitle="⚙️ (Required)"
							description="Essential infrastructure - auto-installs han binary, provides hook system and MCP servers"
						/>
						<CategoryCard
							href="/plugins/do"
							icon={getCategoryIcon("do")}
							title="Dō"
							subtitle="道 - The Way"
							description="Specialized agents for development disciplines and practices"
						/>
						<CategoryCard
							href="/plugins/jutsu"
							icon={getCategoryIcon("jutsu")}
							title="Jutsu"
							subtitle="術 - Techniques"
							description="Language and tool skills with validation hooks for quality"
						/>
						<CategoryCard
							href="/plugins/hashi"
							icon={getCategoryIcon("hashi")}
							title="Hashi"
							subtitle="橋 - Bridges"
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
					<p className="text-center text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
						Install with a single command - validation hooks work out of the box
					</p>
					<div className="max-w-2xl mx-auto">
						<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
								Quick Install
							</h3>
							<p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
								Install the han binary:
							</p>
							<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm mb-4">
								<code>curl -fsSL https://han.guru/install.sh | bash</code>
							</pre>
							<p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
								Then auto-detect and install plugins for your project (always
								includes required core plugin):
							</p>
							<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
								<code>han plugin install --auto</code>
							</pre>
						</div>
						<div className="mt-6 text-center">
							<Link
								href="/docs#installation"
								className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
							>
								More installation methods
							</Link>
							<span className="text-gray-500 dark:text-gray-400 mx-2">|</span>
							<Link
								href="/docs"
								className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
							>
								Full documentation
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* MCP Server - Natural Language Hook Commands */}
			<section id="mcp-server" className="py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						Natural Language Hook Commands
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
						Install hashi-han to run hook commands via natural language.
						&quot;Run the elixir tests&quot; instead of remembering exact
						commands.
					</p>

					<div className="max-w-2xl mx-auto">
						<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-6">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
								Install the MCP Server
							</h3>
							<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
								<code>
									npx @thebushidocollective/han plugin install hashi-han
								</code>
							</pre>
						</div>

						<div className="grid md:grid-cols-2 gap-4 mb-6">
							<div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
								<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
									Dynamic Discovery
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300">
									Tools are generated from installed plugins. Install
									jutsu-typescript, get{" "}
									<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
										jutsu_typescript_typecheck
									</code>
								</p>
							</div>
							<div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
								<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
									Smart Caching
								</h4>
								<p className="text-sm text-gray-600 dark:text-gray-300">
									All hook caching applies. Only runs when files have changed.
									Fast feedback always.
								</p>
							</div>
						</div>

						<div className="text-center">
							<Link
								href="/docs#mcp-server"
								className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
							>
								Learn more about the MCP Server
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Phases of Trust */}
			<section className="py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						Phases of Trust
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
						Start personal, grow to team alignment
					</p>

					<div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
						<TrustPhaseCard
							phase={1}
							color="blue"
							title="User"
							flag="--scope user"
							isDefault
							description="Install for yourself only. Perfect for trying out plugins across all your projects."
							path="~/.claude/settings.json"
						/>
						<TrustPhaseCard
							phase={2}
							color="amber"
							title="Local"
							flag="--scope local"
							description="Project-specific but personal. More control without affecting your team."
							path=".claude/settings.local.json"
							note="gitignored"
						/>
						<TrustPhaseCard
							phase={3}
							color="green"
							title="Project"
							flag="--scope project"
							description="Align your team. Everyone uses the same plugins and validation hooks."
							path=".claude/settings.json"
							note="committed to git"
						/>
					</div>

					<div className="mt-8 text-center">
						<Link
							href="/docs#installation-scopes"
							className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
						>
							Learn more about installation scopes →
						</Link>
					</div>
				</div>
			</section>
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

function PillarCard({
	kanji,
	reading,
	title,
	description,
	features,
}: {
	kanji: string;
	reading: string;
	title: string;
	description: string;
	features: string[];
}) {
	return (
		<div className="text-center">
			<div className="mb-6">
				<span className="text-7xl font-bold text-gray-900 dark:text-white">
					{kanji}
				</span>
				<p className="text-sm text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-wider">
					{reading}
				</p>
			</div>
			<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
				{title}
			</h3>
			<p className="text-gray-600 dark:text-gray-300 mb-6">{description}</p>
			<ul className="text-left space-y-2">
				{features.map((feature) => (
					<li
						key={feature}
						className="flex items-start gap-2 text-gray-600 dark:text-gray-300"
					>
						<span className="text-gray-400 dark:text-gray-500 mt-1">-</span>
						<span>{feature}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function TrustPhaseCard({
	phase,
	color,
	title,
	flag,
	isDefault,
	description,
	path,
	note,
}: {
	phase: number;
	color: "blue" | "amber" | "green";
	title: string;
	flag: string;
	isDefault?: boolean;
	description: string;
	path: string;
	note?: string;
}) {
	const colorClasses = {
		blue: "border-blue-500 text-blue-500",
		amber: "border-amber-500 text-amber-500",
		green: "border-green-500 text-green-500",
	};

	return (
		<div
			className={`bg-white dark:bg-gray-700 p-6 rounded-lg border-l-4 ${colorClasses[color].split(" ")[0]}`}
		>
			<div className="flex items-center gap-3 mb-3">
				<span
					className={`text-2xl font-bold ${colorClasses[color].split(" ")[1]}`}
				>
					{phase}
				</span>
				<div>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						{title}
						{isDefault && (
							<span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
								(default)
							</span>
						)}
					</h3>
					<code className="text-xs text-gray-500 dark:text-gray-400">
						{flag}
					</code>
				</div>
			</div>
			<p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
				{description}
			</p>
			<p className="text-xs text-gray-500 dark:text-gray-400">
				<code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">
					{path}
				</code>
				{note && <span className="ml-1">({note})</span>}
			</p>
		</div>
	);
}
