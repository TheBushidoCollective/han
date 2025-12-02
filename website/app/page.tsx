import type { Metadata } from "next";
import Link from "next/link";
import { getCategoryIcon } from "../lib/plugins";
import Header from "./components/Header";

export const metadata: Metadata = {
	title: "Han - Sophisticated Claude Code Plugins with Superior Accuracy",
	description:
		"A curated marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues. Master your craft through disciplined practice, quality craftsmanship, and continuous improvement.",
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

			{/* The Han Difference - Three Pillars */}
			<section className="bg-white dark:bg-gray-800 py-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
						More Than Just Prompts
					</h2>
					<p className="text-center text-gray-600 dark:text-gray-300 mb-16 max-w-3xl mx-auto text-lg">
						Every Han plugin is a complete mastery system built on three
						pillars. Not just what to do, but how to do it right—with validation
						that ensures excellence.
					</p>

					<div className="grid md:grid-cols-3 gap-8 lg:gap-12">
						<PillarCard
							kanji="知"
							reading="Chi"
							title="Knowledge"
							description="Deep expertise distilled into skills and patterns. Not just answers, but understanding—the wisdom to know why, not just how."
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
							description="Validation hooks that enforce quality automatically. Every change verified, every standard upheld—excellence through enforcement."
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
							href="/plugins/bushido"
							icon={getCategoryIcon("bushido")}
							title="Bushido"
							subtitle="武士道"
							description="Core principles, enforcement hooks, and foundational quality skills"
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
						No installation required - use npx to get started instantly
					</p>
					<div className="max-w-2xl mx-auto">
						<div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
								Install with npx
							</h3>
							<p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
								Auto-detect and install plugins for your project:
							</p>
							<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm mb-4">
								<code>npx @thebushidocollective/han plugin install --auto</code>
							</pre>
							<p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
								Or install a specific plugin:
							</p>
							<pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded overflow-x-auto text-sm">
								<code>
									npx @thebushidocollective/han plugin install bushido
								</code>
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
