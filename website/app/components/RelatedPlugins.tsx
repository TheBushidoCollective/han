import Link from "next/link";

interface RelatedPlugin {
	name: string;
	description: string;
	category: string;
	sharedTags: string[];
}

interface RelatedPluginsProps {
	plugins: RelatedPlugin[];
}

export default function RelatedPlugins({ plugins }: RelatedPluginsProps) {
	if (plugins.length === 0) return null;

	return (
		<section className="mt-12 pt-12 border-t border-gray-200 dark:border-gray-700">
			<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
				Related Plugins
			</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{plugins.map((plugin) => (
					<Link
						key={plugin.name}
						href={`/plugins/${plugin.category}/${plugin.name}`}
						className="block p-6 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-900 dark:hover:border-white transition"
					>
						<div className="flex items-start justify-between mb-3">
							<h3 className="text-xl font-semibold text-gray-900 dark:text-white">
								{plugin.name}
							</h3>
							<span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded capitalize">
								{plugin.category}
							</span>
						</div>
						<p className="text-gray-600 dark:text-gray-400 mb-4">
							{plugin.description}
						</p>
						{plugin.sharedTags.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{plugin.sharedTags.map((tag) => (
									<span
										key={tag}
										className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
									>
										{tag}
									</span>
								))}
							</div>
						)}
					</Link>
				))}
			</div>
		</section>
	);
}
