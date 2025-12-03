export default function Footer() {
	return (
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
	);
}
