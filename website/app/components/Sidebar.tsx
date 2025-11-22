import Link from "next/link";
import { getAllPlugins } from "../../lib/plugins";

export default function Sidebar() {
	const bukiPlugins = getAllPlugins("buki");
	const doPlugins = getAllPlugins("do");
	const senseiPlugins = getAllPlugins("sensei");

	return (
		<aside className="hidden lg:block w-64 shrink-0">
			<div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
				<nav className="space-y-6">
					{/* Overview */}
					<div>
						<Link
							href="/docs"
							className="block text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300"
						>
							Overview
						</Link>
					</div>

					{/* Bushido */}
					<div>
						<Link
							href="/plugins/bushido"
							className="block text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 mb-2"
						>
							🎯 Bushido
						</Link>
						<p className="text-xs text-gray-500 dark:text-gray-400 ml-4 mb-2">
							Core philosophy and quality principles
						</p>
					</div>

					{/* Dō */}
					<div>
						<Link
							href="/plugins/do"
							className="block text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 mb-2"
						>
							🛤️ Dō
						</Link>
						<p className="text-xs text-gray-500 dark:text-gray-400 ml-4 mb-2">
							Specialized development disciplines
						</p>
						<ul className="space-y-1 ml-4">
							{doPlugins.map((plugin) => (
								<li key={plugin.name}>
									<Link
										href={`/plugins/do/${plugin.name}`}
										className="block text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
									>
										{plugin.title}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Buki */}
					<div>
						<Link
							href="/plugins/buki"
							className="block text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 mb-2"
						>
							⚔️ Buki
						</Link>
						<p className="text-xs text-gray-500 dark:text-gray-400 ml-4 mb-2">
							Technology skills and validations
						</p>
						<ul className="space-y-1 ml-4">
							{bukiPlugins.map((plugin) => (
								<li key={plugin.name}>
									<Link
										href={`/plugins/buki/${plugin.name}`}
										className="block text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
									>
										{plugin.title}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Sensei */}
					<div>
						<Link
							href="/plugins/sensei"
							className="block text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 mb-2"
						>
							👴 Sensei
						</Link>
						<p className="text-xs text-gray-500 dark:text-gray-400 ml-4 mb-2">
							MCP servers for external integrations
						</p>
						<ul className="space-y-1 ml-4">
							{senseiPlugins.map((plugin) => (
								<li key={plugin.name}>
									<Link
										href={`/plugins/sensei/${plugin.name}`}
										className="block text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
									>
										{plugin.title}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</nav>
			</div>
		</aside>
	);
}
