import type { Metadata } from "next";
import Link from "next/link";
import {
	formatPhaseName,
	getPhaseIcon,
	getRunbookCategories,
	getRunbooksForPaper,
} from "../../../../lib/runbooks";
import Header from "../../../components/Header";

const PAPER_SLUG = "ai-dlc-2026";

export const metadata: Metadata = {
	title: "AI-DLC 2026 Runbooks - Han",
	description:
		"Practical guides for executing each phase of the AI-Driven Development Lifecycle",
};

export default function RunbooksIndexPage() {
	const runbooks = getRunbooksForPaper(PAPER_SLUG);
	const categories = getRunbookCategories(PAPER_SLUG);

	// Group runbooks by category
	const runbooksByCategory = runbooks.reduce(
		(acc, runbook) => {
			if (!acc[runbook.phase]) {
				acc[runbook.phase] = [];
			}
			acc[runbook.phase].push(runbook);
			return acc;
		},
		{} as Record<string, typeof runbooks>,
	);

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{/* Breadcrumb */}
				<Link
					href="/papers/ai-dlc-2026"
					className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition mb-8"
				>
					← Back to AI-DLC 2026 Paper
				</Link>

				{/* Hero: Choose Your Path */}
				<section className="mb-16">
					<h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
						Where would you like to start?
					</h1>
					<p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
						Pick the path that matches where you are today.
					</p>

					<div className="grid md:grid-cols-2 gap-4">
						{/* Primary Path: New to AI-DLC */}
						<Link
							href="/papers/ai-dlc-2026/runbooks/reimagining-sdlc"
							className="group relative p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg transition"
						>
							<div className="flex items-start gap-4">
								<span className="text-3xl">🚀</span>
								<div>
									<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
										New to AI-DLC
									</h2>
									<p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
										Understand how AI transforms software development
									</p>
									<span className="inline-flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
										Start with Reimagining SDLC →
									</span>
								</div>
							</div>
						</Link>

						{/* Path: Ready to Adopt */}
						<Link
							href="/papers/ai-dlc-2026/runbooks/incremental-adoption"
							className="group relative p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border-2 border-green-200 dark:border-green-700 rounded-xl hover:border-green-400 dark:hover:border-green-500 hover:shadow-lg transition"
						>
							<div className="flex items-start gap-4">
								<span className="text-3xl">🎯</span>
								<div>
									<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition">
										Ready to adopt
									</h2>
									<p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
										Start small and scale AI-DLC across your team
									</p>
									<span className="inline-flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
										Start with Incremental Adoption →
									</span>
								</div>
							</div>
						</Link>

						{/* Path: Already Using AI */}
						<Link
							href="/papers/ai-dlc-2026/runbooks/mode-selection"
							className="group relative p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition"
						>
							<div className="flex items-start gap-4">
								<span className="text-3xl">🔨</span>
								<div>
									<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
										Already using AI for coding
									</h2>
									<p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
										Learn when to use supervised vs autonomous modes
									</p>
									<span className="inline-flex items-center text-purple-600 dark:text-purple-400 text-sm font-medium">
										Start with Mode Selection →
									</span>
								</div>
							</div>
						</Link>

						{/* Path: Specific Tool */}
						<Link
							href="/papers/ai-dlc-2026/runbooks/claude-code"
							className="group relative p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 border-2 border-orange-200 dark:border-orange-700 rounded-xl hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-lg transition"
						>
							<div className="flex items-start gap-4">
								<span className="text-3xl">🛠️</span>
								<div>
									<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition">
										Looking for tool setup
									</h2>
									<p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
										Configure Claude Code, Cursor, Copilot, and more
									</p>
									<span className="inline-flex items-center text-orange-600 dark:text-orange-400 text-sm font-medium">
										Browse Tool Guides →
									</span>
								</div>
							</div>
						</Link>
					</div>
				</section>

				{/* Workflow Overview - Collapsed by default feel */}
				<section className="mb-16">
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
							The AI-DLC Workflow
						</h2>
					</div>
					<div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
						<div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center">
							<Link
								href="#adoption"
								className="flex flex-col items-center hover:opacity-80 transition"
							>
								<span className="text-2xl mb-1">🔄</span>
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
									Adoption
								</span>
							</Link>
							<span className="text-gray-300 dark:text-gray-600 text-xl hidden md:block">
								→
							</span>
							<Link
								href="#inception-phase"
								className="flex flex-col items-center hover:opacity-80 transition"
							>
								<span className="text-2xl mb-1">🎯</span>
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
									Inception
								</span>
							</Link>
							<span className="text-gray-300 dark:text-gray-600 text-xl hidden md:block">
								→
							</span>
							<Link
								href="#construction-phase"
								className="flex flex-col items-center hover:opacity-80 transition"
							>
								<span className="text-2xl mb-1">🔨</span>
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
									Construction
								</span>
							</Link>
							<span className="text-gray-300 dark:text-gray-600 text-xl hidden md:block">
								→
							</span>
							<Link
								href="#operations-phase"
								className="flex flex-col items-center hover:opacity-80 transition"
							>
								<span className="text-2xl mb-1">📊</span>
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
									Operations
								</span>
							</Link>
						</div>
					</div>
				</section>

				{/* Section Header */}
				<header className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
						All Runbooks
					</h2>
					<p className="text-gray-600 dark:text-gray-400">
						Each runbook includes entry/exit criteria, system prompts, and
						common failure modes.
					</p>
				</header>

				{/* Runbooks by Category */}
				<div className="space-y-12">
					{categories.map((category) => {
						const categoryRunbooks = runbooksByCategory[category] || [];
						if (categoryRunbooks.length === 0) return null;

						return (
							<section key={category}>
								<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
									<span>{getPhaseIcon(category)}</span>
									<span>{formatPhaseName(category)}</span>
								</h2>

								<div className="grid gap-4">
									{categoryRunbooks.map((runbook) => (
										<Link
											key={runbook.slug}
											href={`/papers/ai-dlc-2026/runbooks/${runbook.slug}`}
											className="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition"
										>
											<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
												{runbook.title}
											</h3>
											{runbook.description && (
												<p className="text-gray-600 dark:text-gray-400 text-sm">
													{runbook.description}
												</p>
											)}
										</Link>
									))}
								</div>
							</section>
						);
					})}
				</div>

				{/* Footer */}
				<footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
					<div className="flex items-center justify-between">
						<Link
							href="/papers/ai-dlc-2026"
							className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
						>
							← Back to AI-DLC 2026 Paper
						</Link>
					</div>
				</footer>
			</div>
		</div>
	);
}
