import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getAllPapers } from "../../lib/papers";
import Header from "../components/Header";

export const metadata: Metadata = {
	title: "Research Papers - Han",
	description:
		"Research papers and whitepapers on AI-driven development, autonomous agents, and modern software engineering practices.",
};

export default function PapersPage() {
	const papers = getAllPapers();
	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="max-w-4xl mx-auto">
					<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
						Research Papers
					</h1>
					<p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
						Research papers and whitepapers on AI-driven development, autonomous
						agents, and modern software engineering practices.
					</p>

					<div className="space-y-8">
						{papers.map((paper) => (
							<Link
								key={paper.slug}
								href={`/papers/${paper.slug}`}
								className="block p-8 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-900 dark:hover:border-white transition group"
							>
								<div className="flex flex-col gap-3">
									<div>
										<h2 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
											{paper.title}
										</h2>
										{paper.subtitle && (
											<p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
												{paper.subtitle}
											</p>
										)}
									</div>

									<p className="text-gray-700 dark:text-gray-300">
										{paper.description}
									</p>

									<div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
										<time dateTime={paper.date}>{formatDate(paper.date)}</time>
										<span>•</span>
										<span>By {paper.authors.join(", ")}</span>
									</div>

									<div className="flex flex-wrap gap-2 mt-2">
										{paper.tags.map((tag) => (
											<span
												key={tag}
												className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
											>
												{tag}
											</span>
										))}
									</div>
								</div>
							</Link>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
