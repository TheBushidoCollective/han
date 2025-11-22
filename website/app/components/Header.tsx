import Link from "next/link";

export default function Header({
	showSearch = false,
}: {
	showSearch?: boolean;
}) {
	return (
		<header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
			<nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
				<div className="flex items-center justify-between">
					<Link href="/" className="flex items-center space-x-3">
						<div className="text-4xl">⛩️</div>
						<div className="text-2xl font-bold text-gray-900 dark:text-white">
							Han
						</div>
					</Link>

					<div className="flex items-center space-x-6">
						{showSearch && (
							<Link
								href="/search"
								className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-label="Search icon"
								>
									<title>Search</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
								<span className="hidden sm:inline">Search</span>
							</Link>
						)}

						<Link
							href="/tags"
							className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
						>
							Tags
						</Link>

						<Link
							href="/plugins"
							className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
						>
							Plugins
						</Link>

						<Link
							href="/docs"
							className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
						>
							Docs
						</Link>

						<a
							href="https://github.com/thebushidocollective/han"
							className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
					</div>
				</div>
			</nav>
		</header>
	);
}
